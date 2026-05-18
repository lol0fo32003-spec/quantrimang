import bcrypt from "bcryptjs";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import jwt from "jsonwebtoken";
import net from "net";
import { execFile } from "child_process";
import { promisify } from "util";
import { migrate, pool, seedAdmin, seedThresholds } from "./db.js";
import { PrometheusMetricsProvider } from "./metricsProvider.js";

dotenv.config({ path: new URL("../.env", import.meta.url).pathname });

const app = express();
const port = process.env.PORT || 4000;
const jwtSecret = process.env.JWT_SECRET || "local-dev-secret";
const adminUser = process.env.ADMIN_USER || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const prometheusUrl = process.env.PROMETHEUS_URL || "http://localhost:9090";
const metricsProvider = new PrometheusMetricsProvider({ baseUrl: prometheusUrl });
const execFileAsync = promisify(execFile);
const localHostIp = process.env.LOCAL_HOST_IP || "192.168.31.160";
const localOsName = process.env.LOCAL_OS_NAME || "Ubuntu Server";
const localServices = [
  { id: "local-service-mysql", name: "MySQL Database", type: "database", unit: "mysql", port: 3306, ip: "127.0.0.1" },
  { id: "local-service-firewalld", name: "firewalld", type: "firewall", unit: "firewalld", ip: localHostIp },
  { id: "local-service-apache", name: "Apache HTTP", type: "service", unit: "apache2", port: 80, ip: localHostIp },
  { id: "local-service-ssh", name: "SSH", type: "service", unit: "ssh", port: 22, ip: localHostIp },
  { id: "local-service-prometheus", name: "Prometheus", type: "service", unit: "prometheus", port: 9090, ip: localHostIp },
  { id: "local-service-zabbix-server", name: "Zabbix Server", type: "service", unit: "zabbix-server", port: 10051, ip: localHostIp },
  { id: "local-service-zabbix-agent", name: "Zabbix Agent", type: "service", unit: "zabbix-agent", port: 10050, ip: localHostIp },
  { id: "local-service-snmpd", name: "SNMP Daemon", type: "service", unit: "snmpd", port: 161, ip: "127.0.0.1", protocol: "udp" },
  { id: "local-service-api", name: "Network Monitor API", type: "service", port: Number(port), ip: "127.0.0.1" },
  { id: "local-service-web", name: "Network Monitor Web", type: "service", port: 5173, ip: "127.0.0.1" }
];

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

function toHost(row) {
  return {
    id: row.id,
    name: row.name,
    ip: row.ip,
    os: row.os,
    type: row.type,
    status: row.status,
    prometheusInstance: row.prometheus_instance,
    job: row.job,
    environment: row.environment,
    lastError: row.last_error,
    lastCheck: row.last_scrape_at || row.updated_at,
    metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata || "{}") : row.metadata || {},
    severity: row.severity || "OK",
    openAlerts: Number(row.open_alerts || 0)
  };
}

function targetToHost(target, index) {
  const labels = target.labels || {};
  const discovered = target.discoveredLabels || {};
  const instance = labels.instance || discovered.__address__ || `unknown:${index}`;
  const [host, port = "0"] = instance.split(":");
  const job = labels.job || target.scrapePool || "unknown";
  const role = labels.role || "server";
  const id = `${job}-${host.replace(/[^a-zA-Z0-9_-]/g, "_")}-${port}`;

  return {
    id,
    name: labels.nodename || host,
    ip: host,
    type: role === "local-node" || role === "linux-server" ? "server" : role,
    status: target.health === "up" ? "online" : "offline",
    prometheusInstance: instance,
    job,
    environment: labels.environment || discovered.environment || null,
    lastError: target.lastError || null,
    lastScrapeAt: target.lastScrape ? new Date(target.lastScrape) : null
  };
}

async function isUnitActive(unit) {
  if (!unit) return true;
  try {
    const { stdout } = await execFileAsync("systemctl", ["is-active", unit]);
    return stdout.trim() === "active";
  } catch {
    return false;
  }
}

async function isTcpPortOpen(host, targetPort) {
  if (!targetPort) return true;
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port: targetPort, timeout: 900 });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

async function syncLocalServices() {
  for (const service of localServices) {
    const unitActive = await isUnitActive(service.unit);
    const portOpen = service.protocol === "udp" ? true : await isTcpPortOpen(service.ip, service.port);
    const online = unitActive && portOpen;
    const lastError = online
      ? null
      : [
          service.unit && !unitActive ? `systemd unit ${service.unit} is not active` : null,
          service.port && !portOpen ? `port ${service.port} is not reachable on ${service.ip}` : null
        ]
          .filter(Boolean)
          .join("; ");

    await pool.query(
      `INSERT INTO hosts
        (id, name, ip, os, type, status, prometheus_instance, job, environment, last_error, last_scrape_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'local-services', 'local', ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        ip = VALUES(ip),
        os = VALUES(os),
        type = VALUES(type),
        status = VALUES(status),
        job = VALUES(job),
        environment = VALUES(environment),
        last_error = VALUES(last_error),
        last_scrape_at = NOW(),
        metadata = VALUES(metadata)`,
      [
        service.id,
        service.name,
        service.ip,
        localOsName,
        service.type,
        online ? "online" : "offline",
        `local:${service.id}`,
        lastError,
        JSON.stringify({
          unit: service.unit || null,
          port: service.port || null,
          protocol: service.protocol || "tcp",
          endpoint: service.port ? `${service.protocol || "tcp"}://${service.ip}:${service.port}` : service.ip,
          unitActive,
          portOpen,
          monitoredBy: "systemctl + port check"
        })
      ]
    );

    if (!online) {
      await pool.query(
        `INSERT INTO alerts (host_id, metric, severity, title, message)
         SELECT ?, 'service', 'CRITICAL', ?, ?
         WHERE NOT EXISTS (
          SELECT 1 FROM alerts
          WHERE host_id = ? AND metric = 'service' AND acknowledged = 0
         )`,
        [service.id, `${service.name} service critical`, lastError || `${service.name} is offline`, service.id]
      );
    } else {
      await pool.query(
        "UPDATE alerts SET acknowledged = 1, acknowledged_at = NOW() WHERE host_id = ? AND metric = 'service' AND acknowledged = 0",
        [service.id]
      );
    }
  }
}

async function syncAssets() {
  await syncPrometheusTargets();
  await syncLocalServices();
}

async function syncPrometheusTargets() {
  const targets = await metricsProvider.getTargets();
  const hosts = targets.map(targetToHost);

  for (const host of hosts) {
    let os = null;
    if (host.status === "online") {
      try {
        os = (await metricsProvider.getHostInfo({ ...host, prometheusInstance: host.prometheusInstance })).os;
      } catch {
        os = null;
      }
    }

    await pool.query(
      `INSERT INTO hosts
        (id, name, ip, os, type, status, prometheus_instance, job, environment, last_error, last_scrape_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        ip = VALUES(ip),
        os = COALESCE(VALUES(os), os),
        type = VALUES(type),
        status = VALUES(status),
        prometheus_instance = VALUES(prometheus_instance),
        job = VALUES(job),
        environment = VALUES(environment),
        last_error = VALUES(last_error),
        last_scrape_at = VALUES(last_scrape_at)`,
      [
        host.id,
        host.name,
        host.ip,
        os,
        host.type,
        host.status,
        host.prometheusInstance,
        host.job,
        host.environment,
        host.lastError,
        host.lastScrapeAt
      ]
    );

    if (host.status === "offline") {
      await pool.query(
        `INSERT INTO alerts (host_id, metric, severity, title, message)
         SELECT ?, 'connection', 'CRITICAL', ?, ?
         WHERE NOT EXISTS (
          SELECT 1 FROM alerts
          WHERE host_id = ? AND metric = 'connection' AND acknowledged = 0
         )`,
        [
          host.id,
          `${host.name} connection critical`,
          host.lastError || `Prometheus target ${host.prometheusInstance} is offline`,
          host.id
        ]
      );
    } else {
      await pool.query(
        "UPDATE alerts SET acknowledged = 1, acknowledged_at = NOW() WHERE host_id = ? AND metric = 'connection' AND acknowledged = 0",
        [host.id]
      );
    }
  }

  return hosts;
}

async function listHosts({ type, status } = {}) {
  const params = [];
  const filters = [];
  if (type) {
    filters.push("h.type = ?");
    params.push(type);
  }
  if (status) {
    filters.push("h.status = ?");
    params.push(status);
  }

  const [rows] = await pool.query(
    `SELECT h.*,
      CASE MAX(CASE
        WHEN a.acknowledged = 0 AND a.severity = 'CRITICAL' THEN 4
        WHEN a.acknowledged = 0 AND a.severity = 'HIGH' THEN 3
        WHEN a.acknowledged = 0 AND a.severity = 'WARNING' THEN 2
        WHEN a.acknowledged = 0 AND a.severity = 'INFO' THEN 1
        ELSE 0
      END)
        WHEN 4 THEN 'CRITICAL'
        WHEN 3 THEN 'HIGH'
        WHEN 2 THEN 'WARNING'
        WHEN 1 THEN 'INFO'
        ELSE 'OK'
      END AS severity,
      SUM(CASE WHEN a.acknowledged = 0 THEN 1 ELSE 0 END) AS open_alerts
     FROM hosts h
     LEFT JOIN alerts a ON a.host_id = h.id
     ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
     GROUP BY h.id
     ORDER BY h.name`,
    params
  );

  return rows.map(toHost);
}

async function getHost(id) {
  const [rows] = await pool.query("SELECT * FROM hosts WHERE id = ?", [id]);
  return rows[0] ? toHost(rows[0]) : null;
}

async function listAlerts({ severity, acknowledged, hostId } = {}) {
  const params = [];
  const filters = [];
  if (severity) {
    filters.push("a.severity = ?");
    params.push(severity);
  }
  if (acknowledged !== undefined) {
    filters.push("a.acknowledged = ?");
    params.push(acknowledged === "true" || acknowledged === true ? 1 : 0);
  }
  if (hostId) {
    filters.push("a.host_id = ?");
    params.push(hostId);
  }

  const [rows] = await pool.query(
    `SELECT a.*, h.name AS host_name, h.ip AS host_ip
     FROM alerts a
     JOIN hosts h ON h.id = a.host_id
     ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
     ORDER BY a.acknowledged ASC, a.created_at DESC
     LIMIT 100`,
    params
  );

  return rows.map((row) => ({
    id: String(row.id),
    assetId: row.host_id,
    metric: row.metric,
    severity: row.severity,
    title: row.title,
    message: row.message,
    value: Number(row.value),
    thresholdValue: Number(row.threshold_value),
    acknowledged: Boolean(row.acknowledged),
    acknowledgedAt: row.acknowledged_at,
    createdAt: row.created_at,
    asset: { id: row.host_id, name: row.host_name, ip: row.host_ip }
  }));
}

async function evaluateAlerts(host, metrics) {
  const [thresholds] = await pool.query("SELECT * FROM thresholds WHERE enabled = 1");
  const current = metrics.current || {};

  for (const threshold of thresholds) {
    const value = Number(current[threshold.metric]);
    if (!Number.isFinite(value)) continue;

    const critical = Number(threshold.critical_value);
    const warning = Number(threshold.warning_value);
    const severity = value >= critical ? "CRITICAL" : value >= warning ? "WARNING" : null;
    if (!severity) continue;

    const thresholdValue = severity === "CRITICAL" ? critical : warning;
    const title = `${host.name} ${threshold.metric} ${severity.toLowerCase()}`;
    const message = `${threshold.metric} is ${value}, threshold is ${thresholdValue}`;

    await pool.query(
      `INSERT INTO alerts (host_id, metric, severity, title, message, value, threshold_value)
       SELECT ?, ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (
        SELECT 1 FROM alerts
        WHERE host_id = ? AND metric = ? AND acknowledged = 0
       )`,
      [host.id, threshold.metric, severity, title, message, value, thresholdValue, host.id, threshold.metric]
    );
  }
}

async function hostMetrics(host) {
  if (host.prometheusInstance?.startsWith("local:")) {
    return {
      assetId: host.id,
      sampledAt: new Date().toISOString(),
      source: "local-service",
      instance: host.prometheusInstance,
      current: {
        cpu: 0,
        memory: 0,
        disk: 0,
        uptime: host.status === "online" ? 100 : 0,
        loadAverage: 0,
        latency: 0,
        packetLoss: 0,
        trafficIn: 0,
        trafficOut: 0,
        httpStatus: host.status === "online" ? 200 : 503
      },
      history: { cpu: [], memory: [], disk: [], latency: [], trafficIn: [], trafficOut: [] }
    };
  }

  if (host.status !== "online") {
    return {
      assetId: host.id,
      sampledAt: new Date().toISOString(),
      source: "prometheus",
      instance: host.prometheusInstance,
      current: {
        cpu: 0,
        memory: 0,
        disk: 0,
        uptime: 0,
        loadAverage: 0,
        latency: 0,
        packetLoss: 0,
        trafficIn: 0,
        trafficOut: 0,
        httpStatus: null
      },
      history: { cpu: [], memory: [], disk: [], latency: [], trafficIn: [], trafficOut: [] }
    };
  }

  const metrics = await metricsProvider.getAssetMetrics(host);
  await evaluateAlerts(host, metrics);
  return metrics;
}

const authenticate = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", sampledAt: new Date().toISOString(), prometheusUrl });
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const [rows] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
  const user = rows[0];

  if (!user || !(await bcrypt.compare(password || "", user.password_hash))) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const token = jwt.sign({ username: user.username, role: user.role }, jwtSecret, { expiresIn: "8h" });
  return res.json({ token, user: { username: user.username, role: user.role } });
});

app.get("/api/me", authenticate, (req, res) => {
  res.json({ user: { username: req.user.username, role: req.user.role } });
});

app.get("/api/assets", authenticate, async (req, res) => {
  await syncAssets();
  const assets = await listHosts(req.query);
  const withMetrics = await Promise.all(
    assets.map(async (asset) => {
      try {
        const metrics = await hostMetrics(asset);
        return { ...asset, metrics: metrics.current };
      } catch {
        return { ...asset, metrics: null };
      }
    })
  );
  res.json({ assets: withMetrics });
});

app.get("/api/assets/:id", authenticate, async (req, res) => {
  await syncAssets();
  const asset = await getHost(req.params.id);
  if (!asset) {
    return res.status(404).json({ error: "Asset not found" });
  }

  res.json({
    asset,
    alerts: await listAlerts({ hostId: asset.id })
  });
});

app.get("/api/assets/:id/metrics", authenticate, async (req, res) => {
  const asset = await getHost(req.params.id);
  if (!asset) {
    return res.status(404).json({ error: "Asset not found" });
  }

  try {
    const metrics = await hostMetrics(asset);
    res.json({ metrics });
  } catch (error) {
    res.status(502).json({
      error: "Could not load Prometheus metrics",
      detail: error.message
    });
  }
});

app.get("/api/alerts", authenticate, async (req, res) => {
  res.json({ alerts: await listAlerts(req.query) });
});

app.post("/api/alerts/:id/ack", authenticate, async (req, res) => {
  const [result] = await pool.query(
    "UPDATE alerts SET acknowledged = 1, acknowledged_at = NOW() WHERE id = ?",
    [req.params.id]
  );
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: "Alert not found" });
  }
  const [rows] = await pool.query("SELECT host_id FROM alerts WHERE id = ?", [req.params.id]);
  const [alert] = await listAlerts({ hostId: rows[0].host_id });
  res.json({ alert });
});

await migrate();
await seedAdmin({ username: adminUser, password: adminPassword });
await seedThresholds();
await syncAssets();

app.listen(port, () => {
  console.log(`Network monitor API listening on http://localhost:${port}`);
  console.log(`Prometheus metrics enabled from ${prometheusUrl}`);
});
