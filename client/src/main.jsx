import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Cpu,
  Gauge,
  HardDrive,
  LayoutDashboard,
  Lock,
  LogOut,
  Network,
  Router,
  Search,
  Server,
  Settings,
  Shield,
  Wifi
} from "lucide-react";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const severityOrder = { OK: 0, INFO: 1, WARNING: 2, HIGH: 3, CRITICAL: 4 };
const severityLabels = ["OK", "INFO", "WARNING", "HIGH", "CRITICAL"];

function apiFetch(path, token, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  });
}

function formatTime(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}

function assetIcon(type) {
  if (type === "server") return <Server size={18} />;
  if (type === "router") return <Router size={18} />;
  if (type === "switch") return <Network size={18} />;
  if (type === "firewall") return <Shield size={18} />;
  return <Wifi size={18} />;
}

function Badge({ children, tone = "OK" }) {
  return <span className={`badge badge-${tone.toLowerCase()}`}>{children}</span>;
}

function MetricCard({ icon, label, value, detail, tone = "neutral" }) {
  return (
    <section className={`metric-card metric-${tone}`}>
      <div className="metric-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </section>
  );
}

function MiniChart({ series, color = "#2563eb", unit = "" }) {
  const points = series || [];
  if (points.length === 0) {
    return <div className="chart chart-empty">No data</div>;
  }

  const max = Math.max(...points.map((point) => point.value), 1);
  const min = Math.min(...points.map((point) => point.value), 0);
  const range = max - min || 1;
  const polyline = points
    .map((point, index) => {
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100;
      const y = 38 - ((point.value - min) / range) * 30;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="chart">
      <svg viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <div className="chart-scale">
        <span>{max}{unit}</span>
        <span>{min}{unit}</span>
      </div>
    </div>
  );
}

function Login({ onLogin }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/api/auth/login", null, {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      localStorage.setItem("network-monitor-token", data.token);
      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={submit}>
        <div className="brand-mark"><Activity size={28} /></div>
        <h1>Network Monitor</h1>
        <p>Đăng nhập quản trị để xem trạng thái hệ thống.</p>
        <label>
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <button type="submit" disabled={loading}>
          <Lock size={16} />
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}

function Shell({ page, setPage, user, onLogout, children }) {
  const nav = [
    ["dashboard", "Dashboard", LayoutDashboard],
    ["assets", "Hosts & Devices", Server],
    ["alerts", "Alerts", Bell],
    ["settings", "Settings", Settings]
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Activity size={24} />
          <span>NetWatch</span>
        </div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}>
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <span>{user?.username || "admin"}</span>
          <small>role: admin</small>
          <button onClick={onLogout}><LogOut size={16} /> Logout</button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

function Dashboard({ assets, alerts, onSelectAsset }) {
  const openAlerts = alerts.filter((alert) => !alert.acknowledged);
  const critical = openAlerts.filter((alert) => alert.severity === "CRITICAL").length;
  const online = assets.filter((asset) => asset.status === "online").length;
  const serviceHealth = Math.round((online / Math.max(assets.length, 1)) * 100);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Tổng quan trạng thái server, network device và service." />
      <div className="metric-grid">
        <MetricCard icon={<CheckCircle2 />} label="Online assets" value={`${online}/${assets.length}`} detail="đang phản hồi" tone="ok" />
        <MetricCard icon={<AlertTriangle />} label="Critical alerts" value={critical} detail="chưa acknowledge" tone="critical" />
        <MetricCard icon={<Gauge />} label="Service health" value={`${serviceHealth}%`} detail="dựa trên trạng thái asset" tone="info" />
        <MetricCard icon={<Cpu />} label="Open alerts" value={openAlerts.length} detail="warning trở lên cần xử lý" tone="warning" />
      </div>
      <section className="panel">
        <div className="panel-title">
          <h2>Asset status</h2>
          <span>{assets.length} monitored objects</span>
        </div>
        <AssetTable assets={assets} onSelectAsset={onSelectAsset} compact />
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>Recent alerts</h2>
          <span>{openAlerts.length} open</span>
        </div>
        <AlertList alerts={alerts.slice(0, 5)} />
      </section>
    </>
  );
}

function AssetsPage({ assets, selectedAsset, setSelectedAsset, token }) {
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null);
  const [metrics, setMetrics] = useState(null);

  const filtered = assets.filter((asset) => {
    const matchesType = type === "all" || asset.type === type;
    const matchesStatus = status === "all" || asset.status === status;
    const matchesQuery = `${asset.name} ${asset.ip}`.toLowerCase().includes(query.toLowerCase());
    return matchesType && matchesStatus && matchesQuery;
  });

  useEffect(() => {
    if (!selectedAsset) return;
    let cancelled = false;
    async function loadDetail() {
      const [assetData, metricData] = await Promise.all([
        apiFetch(`/api/assets/${selectedAsset}`, token),
        apiFetch(`/api/assets/${selectedAsset}/metrics`, token)
      ]);
      if (!cancelled) {
        setDetail(assetData);
        setMetrics(metricData.metrics);
      }
    }
    loadDetail().catch(console.error);
    const timer = setInterval(loadDetail, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedAsset, token]);

  return (
    <>
      <PageHeader title="Hosts & Devices" subtitle="Lọc, kiểm tra trạng thái và xem metric theo từng asset." />
      <div className="toolbar">
        <div className="searchbox"><Search size={16} /><input placeholder="Tìm theo tên hoặc IP" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="all">All types</option>
          <option value="server">Server</option>
          <option value="router">Router</option>
          <option value="switch">Switch</option>
          <option value="firewall">Firewall</option>
          <option value="service">Service</option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="online">Online</option>
          <option value="degraded">Degraded</option>
          <option value="offline">Offline</option>
        </select>
      </div>
      <div className="split">
        <section className="panel">
          <AssetTable assets={filtered} onSelectAsset={setSelectedAsset} selectedAsset={selectedAsset} />
        </section>
        <AssetDetail detail={detail} metrics={metrics} />
      </div>
    </>
  );
}

function AssetTable({ assets, onSelectAsset, selectedAsset, compact = false }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Asset</th>
            <th>IP / Endpoint</th>
            <th>Status</th>
            <th>Severity</th>
            {!compact ? <th>Last check</th> : null}
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id} className={selectedAsset === asset.id ? "selected" : ""} onClick={() => onSelectAsset(asset.id)}>
              <td>
                <div className="asset-cell">
                  {assetIcon(asset.type)}
                  <div><strong>{asset.name}</strong><span>{asset.type}</span></div>
                </div>
              </td>
              <td>{asset.ip}</td>
              <td><span className={`status-dot ${asset.status}`}></span>{asset.status}</td>
              <td><Badge tone={asset.severity}>{asset.severity}</Badge></td>
              {!compact ? <td>{formatTime(asset.lastCheck)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssetDetail({ detail, metrics }) {
  if (!detail || !metrics) {
    return (
      <section className="panel detail-empty">
        <Network size={34} />
        <h2>Chọn một asset</h2>
        <p>Xem metric, interface/service và cảnh báo gần nhất.</p>
      </section>
    );
  }

  const asset = detail.asset;
  const items = asset.interfaces || asset.services || [];

  return (
    <section className="panel asset-detail">
      <div className="detail-heading">
        <div>{assetIcon(asset.type)}<div><h2>{asset.name}</h2><span>{asset.ip}</span></div></div>
        <Badge tone={asset.severity}>{asset.severity}</Badge>
      </div>
      <div className="small-metrics">
        <MetricPill label="CPU" value={`${metrics.current.cpu}%`} />
        <MetricPill label="RAM" value={`${metrics.current.memory}%`} />
        <MetricPill label="Disk" value={`${metrics.current.disk}%`} />
        <MetricPill label="Latency" value={`${metrics.current.latency}ms`} />
        <MetricPill label="Loss" value={`${metrics.current.packetLoss}%`} />
        <MetricPill label="Uptime" value={`${metrics.current.uptime}%`} />
      </div>
      <div className="chart-grid">
        <ChartPanel title="CPU" series={metrics.history.cpu} unit="%" color="#ef4444" />
        <ChartPanel title="Memory" series={metrics.history.memory} unit="%" color="#2563eb" />
        <ChartPanel title="Latency" series={metrics.history.latency} unit="ms" color="#f59e0b" />
        <ChartPanel title="Traffic in" series={metrics.history.trafficIn} unit="Mb" color="#16a34a" />
      </div>
      <h3>Interfaces / Services</h3>
      <div className="chips">{items.map((item) => <span key={item}>{item}</span>)}</div>
      <h3>Recent alerts</h3>
      <AlertList alerts={detail.alerts} dense />
    </section>
  );
}

function MetricPill({ label, value }) {
  return <div className="metric-pill"><span>{label}</span><strong>{value}</strong></div>;
}

function ChartPanel({ title, series, unit, color }) {
  return <div className="chart-panel"><div><strong>{title}</strong><span>last 24 samples</span></div><MiniChart series={series} unit={unit} color={color} /></div>;
}

function AlertsPage({ alerts, refresh, token }) {
  const [severity, setSeverity] = useState("all");
  const [ack, setAck] = useState("all");
  const filtered = alerts.filter((alert) => {
    const severityOk = severity === "all" || alert.severity === severity;
    const ackOk = ack === "all" || String(alert.acknowledged) === ack;
    return severityOk && ackOk;
  });

  async function acknowledge(id) {
    await apiFetch(`/api/alerts/${id}/ack`, token, { method: "POST" });
    refresh();
  }

  return (
    <>
      <PageHeader title="Alerts" subtitle="Theo dõi severity và acknowledge sự cố đang mở." />
      <div className="toolbar">
        <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
          <option value="all">All severities</option>
          {severityLabels.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={ack} onChange={(event) => setAck(event.target.value)}>
          <option value="all">All states</option>
          <option value="false">Unacknowledged</option>
          <option value="true">Acknowledged</option>
        </select>
      </div>
      <section className="panel">
        <AlertList alerts={filtered} onAck={acknowledge} />
      </section>
    </>
  );
}

function AlertList({ alerts, onAck, dense = false }) {
  const sorted = [...alerts].sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
  return (
    <div className={`alert-list ${dense ? "dense" : ""}`}>
      {sorted.map((alert) => (
        <article className="alert-row" key={alert.id}>
          <Badge tone={alert.severity}>{alert.severity}</Badge>
          <div>
            <strong>{alert.title}</strong>
            <p>{alert.message}</p>
            <span>{alert.asset?.name || alert.assetId} · {formatTime(alert.createdAt)}</span>
          </div>
          {onAck && !alert.acknowledged ? <button onClick={() => onAck(alert.id)}>Ack</button> : <small>{alert.acknowledged ? "Acknowledged" : "Open"}</small>}
        </article>
      ))}
    </div>
  );
}

function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Cấu hình runtime và adapter dữ liệu cho MVP." />
      <section className="panel settings-panel">
        <h2>Metrics provider</h2>
        <p>Provider hiện tại là <strong>MockMetricsProvider</strong>. Khi có Prometheus, thay adapter backend để gọi PromQL qua cùng API frontend.</p>
        <div className="config-list">
          <span>API base</span><code>{API_BASE}</code>
          <span>Auth mode</span><code>single admin JWT</code>
          <span>Polling</span><code>10s asset detail refresh</code>
        </div>
      </section>
    </>
  );
}

function PageHeader({ title, subtitle }) {
  return <header className="page-header"><div><h1>{title}</h1><p>{subtitle}</p></div></header>;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("network-monitor-token"));
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [assets, setAssets] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);

  const refresh = async () => {
    if (!token) return;
    const [assetData, alertData] = await Promise.all([
      apiFetch("/api/assets", token),
      apiFetch("/api/alerts", token)
    ]);
    setAssets(assetData.assets);
    setAlerts(alertData.alerts);
    setSelectedAsset((current) => current || assetData.assets[0]?.id || null);
  };

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/me", token)
      .then((data) => setUser(data.user))
      .then(refresh)
      .catch(() => {
        localStorage.removeItem("network-monitor-token");
        setToken(null);
      });
  }, [token]);

  const currentPage = useMemo(() => {
    if (page === "assets") return <AssetsPage assets={assets} selectedAsset={selectedAsset} setSelectedAsset={setSelectedAsset} token={token} />;
    if (page === "alerts") return <AlertsPage alerts={alerts} refresh={refresh} token={token} />;
    if (page === "settings") return <SettingsPage />;
    return <Dashboard assets={assets} alerts={alerts} onSelectAsset={(id) => { setSelectedAsset(id); setPage("assets"); }} />;
  }, [page, assets, alerts, selectedAsset, token]);

  if (!token) {
    return <Login onLogin={(nextToken, nextUser) => { setToken(nextToken); setUser(nextUser); }} />;
  }

  return (
    <Shell
      page={page}
      setPage={setPage}
      user={user}
      onLogout={() => {
        localStorage.removeItem("network-monitor-token");
        setToken(null);
      }}
    >
      {currentPage}
    </Shell>
  );
}

createRoot(document.getElementById("root")).render(<App />);
