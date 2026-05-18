export const severities = ["OK", "INFO", "WARNING", "HIGH", "CRITICAL"];

// Build assets from Prometheus targets if PROMETHEUS_URL is provided,
// otherwise export an empty list fallback to avoid breaking imports.
const PROM_URL = process.env.PROMETHEUS_URL || process.env.PROM_URL || "http://localhost:9090";

const fetchTargets = async () => {
  try {
    const res = await fetch(`${PROM_URL.replace(/\/$/, "")}/api/v1/targets`);
    const payload = await res.json();
    if (!res.ok || payload.status !== "success") return [];

    const active = payload.data.activeTargets || [];
    return active.map((t, idx) => {
      const inst = (t.labels && t.labels.instance) || t.discoveredLabels?.__address__ || `unknown:${idx}`;
      const [host, port] = inst.split(":");
      const job = (t.labels && t.labels.job) || t.scrapePool || "unknown";
      const role = (t.labels && t.labels.role) || "server";
      return {
        id: `${job}-${host.replace(/[^a-zA-Z0-9_-]/g, "_")}-${port || "0"}`,
        name: host,
        type: role === "local-node" ? "server" : role,
        ip: host,
        prometheusInstance: inst,
        location: job,
        status: t.health === "up" ? "online" : (t.health === "down" ? "offline" : "unknown"),
        severity: "OK",
        tags: [job, role],
        services: t.discoveredLabels && t.discoveredLabels.__metrics_path__ === "/metrics" ? ["node-exporter"] : []
      };
    });
  } catch (e) {
    return [];
  }
};

export const assets = await fetchTargets();

export const alerts = [];
