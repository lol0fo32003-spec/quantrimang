const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const wave = (seed, min, max, speed = 1) => {
  const now = Date.now() / 1000;
  const raw = Math.sin(now * speed + seed) * 0.5 + 0.5;
  return Math.round(min + raw * (max - min));
};

const series = (seed, min, max, points = 24) => {
  const now = Date.now();
  return Array.from({ length: points }, (_, index) => {
    const offset = points - index - 1;
    const value = wave(seed + index * 0.37, min, max, 0.7);
    return {
      timestamp: new Date(now - offset * 60_000).toISOString(),
      value
    };
  });
};

export class MockMetricsProvider {
  getAssetMetrics(asset) {
    const seed = asset.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const isNetwork = ["router", "switch", "firewall"].includes(asset.type);
    const cpu = wave(seed, asset.severity === "HIGH" ? 58 : 18, asset.severity === "HIGH" ? 91 : 78, 0.35);
    const memory = wave(seed + 11, 34, 88, 0.31);
    const disk = wave(seed + 17, asset.type === "server" ? 42 : 18, asset.type === "server" ? 92 : 56, 0.18);
    const latency = wave(seed + 23, isNetwork ? 4 : 18, asset.severity === "CRITICAL" ? 165 : 58, 0.52);
    const packetLoss = clamp(wave(seed + 29, 0, asset.severity === "CRITICAL" ? 16 : 4, 0.48), 0, 100);
    const httpStatus = asset.type === "service" ? (asset.severity === "OK" ? 200 : 503) : null;

    return {
      assetId: asset.id,
      sampledAt: new Date().toISOString(),
      current: {
        cpu,
        memory,
        disk,
        uptime: wave(seed + 31, 97, 100, 0.05),
        latency,
        packetLoss,
        trafficIn: wave(seed + 41, 110, isNetwork ? 920 : 360, 0.44),
        trafficOut: wave(seed + 43, 90, isNetwork ? 780 : 310, 0.39),
        httpStatus
      },
      history: {
        cpu: series(seed, Math.max(5, cpu - 24), Math.min(100, cpu + 18)),
        memory: series(seed + 11, Math.max(10, memory - 18), Math.min(100, memory + 16)),
        latency: series(seed + 23, Math.max(1, latency - 22), latency + 32),
        trafficIn: series(seed + 41, 80, isNetwork ? 980 : 410),
        trafficOut: series(seed + 43, 70, isNetwork ? 860 : 350)
      }
    };
  }
}

export class PrometheusMetricsProvider {
  constructor({ baseUrl }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async request(path, params = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url);
    const payload = await response.json();

    if (!response.ok || payload.status !== "success") {
      throw new Error(payload.error || `Prometheus request failed: ${path}`);
    }

    return payload.data;
  }

  async getTargets() {
    const data = await this.request("/api/v1/targets");
    return data.activeTargets || [];
  }

  async query(promql) {
    const data = await this.request("/api/v1/query", { query: promql });
    const value = data.result[0]?.value?.[1];
    return value === undefined ? 0 : Number(value);
  }

  async queryVector(promql) {
    const data = await this.request("/api/v1/query", { query: promql });
    return data.result || [];
  }

  async queryRange(promql, minutes = 60, stepSeconds = 150) {
    const end = Math.floor(Date.now() / 1000);
    const start = end - minutes * 60;

    const data = await this.request("/api/v1/query_range", {
      query: promql,
      start: String(start),
      end: String(end),
      step: String(stepSeconds)
    });

    return (data.result[0]?.values || []).map(([timestamp, value]) => ({
      timestamp: new Date(timestamp * 1000).toISOString(),
      value: Math.round(Number(value) * 100) / 100
    }));
  }

  async getHostInfo(asset) {
    const instance = asset.prometheusInstance || asset.prometheus_instance || `${asset.ip}:9100`;
    const result = await this.queryVector(`node_uname_info{instance="${instance}"}`);
    const metric = result[0]?.metric || {};
    const os = [metric.sysname, metric.release].filter(Boolean).join(" ");
    return {
      os: os || asset.os || null,
      machine: metric.machine || null,
      nodename: metric.nodename || null
    };
  }

  async getAssetMetrics(asset) {
    const instance = asset.prometheusInstance || asset.prometheus_instance || `${asset.ip}:9100`;
    const selector = `{instance="${instance}"}`;
    const rootFsSelector = `{instance="${instance}",fstype!~"tmpfs|overlay|squashfs",mountpoint="/"}`;
    const cpuQuery = `100 - (avg(rate(node_cpu_seconds_total${selector.replace("}", ',mode="idle"}')}[5m])) * 100)`;
    const memoryQuery = `(1 - (node_memory_MemAvailable_bytes${selector} / node_memory_MemTotal_bytes${selector})) * 100`;
    const diskQuery = `100 - ((node_filesystem_avail_bytes${rootFsSelector} * 100) / node_filesystem_size_bytes${rootFsSelector})`;
    const uptimeQuery = `time() - node_boot_time_seconds${selector}`;
    const loadQuery = `node_load1${selector}`;
    const trafficInQuery = `sum(rate(node_network_receive_bytes_total${selector.replace("}", ',device!~"lo|docker.*|veth.*|br.*"}')}[5m])) * 8 / 1000000`;
    const trafficOutQuery = `sum(rate(node_network_transmit_bytes_total${selector.replace("}", ',device!~"lo|docker.*|veth.*|br.*"}')}[5m])) * 8 / 1000000`;

    const [cpu, memory, disk, uptimeSeconds, loadAverage, trafficIn, trafficOut] = await Promise.all([
      this.query(cpuQuery),
      this.query(memoryQuery),
      this.query(diskQuery),
      this.query(uptimeQuery),
      this.query(loadQuery),
      this.query(trafficInQuery),
      this.query(trafficOutQuery)
    ]);

    const [cpuHistory, memoryHistory, diskHistory, trafficInHistory, trafficOutHistory] = await Promise.all([
      this.queryRange(cpuQuery),
      this.queryRange(memoryQuery),
      this.queryRange(diskQuery),
      this.queryRange(trafficInQuery),
      this.queryRange(trafficOutQuery)
    ]);

    return {
      assetId: asset.id,
      sampledAt: new Date().toISOString(),
      source: "prometheus",
      instance,
      current: {
        cpu: Math.round(cpu),
        memory: Math.round(memory),
        disk: Math.round(disk),
        uptime: Math.round(uptimeSeconds),
        loadAverage: Math.round(loadAverage * 100) / 100,
        latency: 0,
        packetLoss: 0,
        trafficIn: Math.round(trafficIn * 100) / 100,
        trafficOut: Math.round(trafficOut * 100) / 100,
        httpStatus: null
      },
      history: {
        cpu: cpuHistory,
        memory: memoryHistory,
        disk: diskHistory,
        latency: [],
        trafficIn: trafficInHistory,
        trafficOut: trafficOutHistory
      }
    };
  }
}
