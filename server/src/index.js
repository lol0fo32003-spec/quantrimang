import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import jwt from "jsonwebtoken";
import { alerts, assets } from "./data.js";
import { MockMetricsProvider, PrometheusMetricsProvider } from "./metricsProvider.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const jwtSecret = process.env.JWT_SECRET || "local-dev-secret";
const adminUser = process.env.ADMIN_USER || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const metricsProvider = process.env.PROMETHEUS_URL
  ? new PrometheusMetricsProvider({ baseUrl: process.env.PROMETHEUS_URL })
  : new MockMetricsProvider();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

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

const enrichAsset = (asset) => ({
  ...asset,
  lastCheck: new Date(Date.now() - Math.floor(Math.random() * 90_000)).toISOString(),
  openAlerts: alerts.filter((alert) => alert.assetId === asset.id && !alert.acknowledged).length
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", sampledAt: new Date().toISOString() });
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (username !== adminUser || password !== adminPassword) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const token = jwt.sign({ username, role: "admin" }, jwtSecret, { expiresIn: "8h" });
  return res.json({ token, user: { username, role: "admin" } });
});

app.get("/api/me", authenticate, (req, res) => {
  res.json({ user: { username: req.user.username, role: req.user.role } });
});

app.get("/api/assets", authenticate, (req, res) => {
  const { type, status } = req.query;
  const result = assets
    .filter((asset) => (type ? asset.type === type : true))
    .filter((asset) => (status ? asset.status === status : true))
    .map(enrichAsset);

  res.json({ assets: result });
});

app.get("/api/assets/:id", authenticate, (req, res) => {
  const asset = assets.find((item) => item.id === req.params.id);
  if (!asset) {
    return res.status(404).json({ error: "Asset not found" });
  }

  res.json({
    asset: enrichAsset(asset),
    alerts: alerts.filter((alert) => alert.assetId === asset.id)
  });
});

app.get("/api/assets/:id/metrics", authenticate, async (req, res) => {
  const asset = assets.find((item) => item.id === req.params.id);
  if (!asset) {
    return res.status(404).json({ error: "Asset not found" });
  }

  try {
    const metrics = await metricsProvider.getAssetMetrics(asset);
    res.json({ metrics });
  } catch (error) {
    res.status(502).json({
      error: "Could not load metrics",
      detail: error.message
    });
  }
});

app.get("/api/alerts", authenticate, (req, res) => {
  const { severity, acknowledged } = req.query;
  const result = alerts
    .filter((alert) => (severity ? alert.severity === severity : true))
    .filter((alert) => {
      if (acknowledged === undefined) return true;
      return String(alert.acknowledged) === acknowledged;
    })
    .map((alert) => ({
      ...alert,
      asset: assets.find((asset) => asset.id === alert.assetId)
    }));

  res.json({ alerts: result });
});

app.post("/api/alerts/:id/ack", authenticate, (req, res) => {
  const alert = alerts.find((item) => item.id === req.params.id);
  if (!alert) {
    return res.status(404).json({ error: "Alert not found" });
  }

  alert.acknowledged = true;
  alert.acknowledgedAt = new Date().toISOString();
  res.json({ alert });
});

app.listen(port, () => {
  console.log(`Network monitor API listening on http://localhost:${port}`);
});
