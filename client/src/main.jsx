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

const localeLabels = { en: "English", vi: "Tiếng Việt" };
const localeMap = { en: "en-US", vi: "vi-VN" };
const messages = {
  en: {
    loginIntro: "Sign in as an administrator to view system status.",
    username: "Username",
    password: "Password",
    signingIn: "Signing in...",
    signIn: "Sign in",
    dashboard: "Dashboard",
    assets: "Hosts & Devices",
    alerts: "Alerts",
    settings: "Settings",
    roleAdmin: "role: admin",
    logout: "Logout",
    dashboardSubtitle: "Overview of server, network device, and service status.",
    onlineAssets: "Online assets",
    responding: "responding",
    criticalAlerts: "Critical alerts",
    unacknowledged: "unacknowledged",
    serviceHealth: "Service health",
    basedOnAssetStatus: "based on asset status",
    openAlerts: "Open alerts",
    warningNeedsAction: "warning or higher needs action",
    assetStatus: "Asset status",
    monitoredObjects: "monitored objects",
    recentAlerts: "Recent alerts",
    open: "open",
    assetsSubtitle: "Filter, inspect status, and view metrics by asset.",
    searchPlaceholder: "Search by name or IP",
    allTypes: "{t("allTypes")}",
    allStatuses: "{t("allStatuses")}",
    asset: "Asset",
    ipEndpoint: "IP / Endpoint",
    status: "Status",
    severity: "Severity",
    lastCheck: "Last check",
    selectAsset: "Select an asset",
    selectAssetHelp: "View metrics, interfaces/services, and recent alerts.",
    memory: "Memory",
    latency: "Latency",
    loss: "Loss",
    uptime: "Uptime",
    trafficIn: "Traffic in",
    interfacesServices: "Interfaces / Services",
    lastSamples: "last 24 samples",
    noData: "No data",
    alertsSubtitle: "Track severity and acknowledge open incidents.",
    allSeverities: "{t("allSeverities")}",
    allStates: "{t("allStates")}",
    acknowledged: "{t("acknowledged")}",
    ack: "Ack",
    settingsSubtitle: "Configure runtime and data adapters for the MVP.",
    metricsProvider: "Metrics provider",
    metricsProviderText: "Current provider is",
    metricsProviderHelp: "When Prometheus is available, swap the backend adapter to call PromQL through the same frontend API.",
    apiBase: "API base",
    authMode: "Auth mode",
    polling: "Polling",
    authModeValue: "single admin JWT",
    pollingValue: "10s asset detail refresh",
    language: "Language"
  },
  vi: {
    loginIntro: "Đăng nhập quản trị để xem trạng thái hệ thống.",
    username: "Tên đăng nhập",
    password: "Mật khẩu",
    signingIn: "Đang đăng nhập...",
    signIn: "Đăng nhập",
    dashboard: "Dashboard",
    assets: "Máy chủ & Thiết bị",
    alerts: "Cảnh báo",
    settings: "Cài đặt",
    roleAdmin: "vai trò: admin",
    logout: "Đăng xuất",
    dashboardSubtitle: "Tổng quan trạng thái server, thiết bị mạng và service.",
    onlineAssets: "Asset online",
    responding: "đang phản hồi",
    criticalAlerts: "Cảnh báo nghiêm trọng",
    unacknowledged: "chưa xác nhận",
    serviceHealth: "Sức khỏe dịch vụ",
    basedOnAssetStatus: "dựa trên trạng thái asset",
    openAlerts: "Cảnh báo mở",
    warningNeedsAction: "warning trở lên cần xử lý",
    assetStatus: "Trạng thái asset",
    monitoredObjects: "đối tượng đang giám sát",
    recentAlerts: "Cảnh báo gần đây",
    open: "đang mở",
    assetsSubtitle: "Lọc, kiểm tra trạng thái và xem metric theo từng asset.",
    searchPlaceholder: "Tìm theo tên hoặc IP",
    allTypes: "Tất cả loại",
    allStatuses: "Tất cả trạng thái",
    asset: "Asset",
    ipEndpoint: "IP / Endpoint",
    status: "Trạng thái",
    severity: "Mức độ",
    lastCheck: "Lần kiểm tra cuối",
    selectAsset: "Chọn một asset",
    selectAssetHelp: "Xem metric, interface/service và cảnh báo gần nhất.",
    memory: "Bộ nhớ",
    latency: "Độ trễ",
    loss: "Mất gói",
    uptime: "Uptime",
    trafficIn: "Traffic vào",
    interfacesServices: "Interfaces / Services",
    lastSamples: "24 mẫu gần nhất",
    noData: "Không có dữ liệu",
    alertsSubtitle: "Theo dõi severity và xác nhận sự cố đang mở.",
    allSeverities: "Tất cả mức độ",
    allStates: "Tất cả trạng thái",
    acknowledged: "Đã xác nhận",
    ack: "Xác nhận",
    settingsSubtitle: "Cấu hình runtime và adapter dữ liệu cho MVP.",
    metricsProvider: "Provider metric",
    metricsProviderText: "Provider hiện tại là",
    metricsProviderHelp: "Khi có Prometheus, thay adapter backend để gọi PromQL qua cùng API frontend.",
    apiBase: "API base",
    authMode: "Chế độ auth",
    polling: "Polling",
    authModeValue: "JWT admin đơn",
    pollingValue: "refresh chi tiết asset mỗi 10s",
    language: "Ngôn ngữ"
  }
};

function getInitialLocale() {
  const saved = localStorage.getItem("network-monitor-locale");
  if (saved === "en" || saved === "vi") return saved;
  return navigator.language?.toLowerCase().startsWith("vi") ? "vi" : "en";
}

function useI18n() {
  const [locale, setLocaleState] = useState(getInitialLocale);
  const setLocale = (nextLocale) => {
    localStorage.setItem("network-monitor-locale", nextLocale);
    setLocaleState(nextLocale);
  };
  const t = (key) => messages[locale][key] || messages.en[key] || key;
  return { locale, setLocale, t };
}

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

function formatTime(value, locale = "vi") {
  return new Intl.DateTimeFormat(localeMap[locale] || localeMap.vi, {
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

function MiniChart({ series, color = "#2563eb", unit = "", t }) {
  const points = series || [];
  if (points.length === 0) {
    return <div className="chart chart-empty">{t("noData")}</div>;
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

function Login({ onLogin, t, locale, setLocale }) {
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
        <p>{t("loginIntro")}</p>
        <label>
          {t("username")}
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>
        <label>
          {t("password")}
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
          {loading ? t("signingIn") : t("signIn")}
        </button>
              <label>
          {t("language")}
          <select value={locale} onChange={(event) => setLocale(event.target.value)}>
            <option value="en">{localeLabels.en}</option>
            <option value="vi">{localeLabels.vi}</option>
          </select>
        </label>
      </form>
    </main>
  );
}

function Shell({ page, setPage, user, onLogout, children, t, locale, setLocale }) {
  const nav = [
    ["dashboard", t("dashboard"), LayoutDashboard],
    ["assets", t("assets"), Server],
    ["alerts", t("alerts"), Bell],
    ["settings", t("settings"), Settings]
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
          <small>{t("roleAdmin")}</small>
          <label className="locale-switch">
            {t("language")}
            <select value={locale} onChange={(event) => setLocale(event.target.value)}>
              <option value="en">{localeLabels.en}</option>
              <option value="vi">{localeLabels.vi}</option>
            </select>
          </label>
          <button onClick={onLogout}><LogOut size={16} /> {t("logout")}</button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

function Dashboard({ assets, alerts, onSelectAsset, t, locale }) {
  const openAlerts = alerts.filter((alert) => !alert.acknowledged);
  const critical = openAlerts.filter((alert) => alert.severity === "CRITICAL").length;
  const online = assets.filter((asset) => asset.status === "online").length;
  const serviceHealth = Math.round((online / Math.max(assets.length, 1)) * 100);

  return (
    <>
      <PageHeader title={t("dashboard")} subtitle={t("dashboardSubtitle")} />
      <div className="metric-grid">
        <MetricCard icon={<CheckCircle2 />} label={t("onlineAssets")} value={`${online}/${assets.length}`} detail={t("responding")} tone="ok" />
        <MetricCard icon={<AlertTriangle />} label={t("criticalAlerts")} value={critical} detail={t("unacknowledged")} tone="critical" />
        <MetricCard icon={<Gauge />} label={t("serviceHealth")} value={`${serviceHealth}%`} detail={t("basedOnAssetStatus")} tone="info" />
        <MetricCard icon={<Cpu />} label={t("openAlerts")} value={openAlerts.length} detail={t("warningNeedsAction")} tone="warning" />
      </div>
      <section className="panel">
        <div className="panel-title">
          <h2>{t("assetStatus")}</h2>
          <span>{assets.length} {t("monitoredObjects")}</span>
        </div>
        <AssetTable assets={assets} onSelectAsset={onSelectAsset} compact t={t} locale={locale} />
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>{t("recentAlerts")}</h2>
          <span>{openAlerts.length} {t("open")}</span>
        </div>
        <AlertList alerts={alerts.slice(0, 5)} t={t} locale={locale} />
      </section>
    </>
  );
}

function AssetsPage({ assets, selectedAsset, setSelectedAsset, token, t, locale }) {
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
      <PageHeader title={t("assets")} subtitle={t("assetsSubtitle")} />
      <div className="toolbar">
        <div className="searchbox"><Search size={16} /><input placeholder={t("searchPlaceholder")} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
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
          <AssetTable assets={filtered} onSelectAsset={setSelectedAsset} selectedAsset={selectedAsset} t={t} locale={locale} />
        </section>
        <AssetDetail detail={detail} metrics={metrics} t={t} locale={locale} />
      </div>
    </>
  );
}

function AssetTable({ assets, onSelectAsset, selectedAsset, compact = false, t, locale }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t("asset")}</th>
            <th>{t("ipEndpoint")}</th>
            <th>{t("status")}</th>
            <th>{t("severity")}</th>
            {!compact ? <th>{t("lastCheck")}</th> : null}
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
              {!compact ? <td>{formatTime(asset.lastCheck, locale)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssetDetail({ detail, metrics, t, locale }) {
  if (!detail || !metrics) {
    return (
      <section className="panel detail-empty">
        <Network size={34} />
        <h2>{t("selectAsset")}</h2>
        <p>{t("selectAssetHelp")}</p>
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
        <MetricPill label={t("latency")} value={`${metrics.current.latency}ms`} />
        <MetricPill label={t("loss")} value={`${metrics.current.packetLoss}%`} />
        <MetricPill label={t("uptime")} value={`${metrics.current.uptime}%`} />
      </div>
      <div className="chart-grid">
        <ChartPanel title="CPU" series={metrics.history.cpu} unit="%" color="#ef4444" t={t} />
        <ChartPanel title={t("memory")} series={metrics.history.memory} unit="%" color="#2563eb" t={t} />
        <ChartPanel title={t("latency")} series={metrics.history.latency} unit="ms" color="#f59e0b" t={t} />
        <ChartPanel title={t("trafficIn")} series={metrics.history.trafficIn} unit="Mb" color="#16a34a" t={t} />
      </div>
      <h3>{t("interfacesServices")}</h3>
      <div className="chips">{items.map((item) => <span key={item}>{item}</span>)}</div>
      <h3>{t("recentAlerts")}</h3>
      <AlertList alerts={detail.alerts} dense t={t} locale={locale} />
    </section>
  );
}

function MetricPill({ label, value }) {
  return <div className="metric-pill"><span>{label}</span><strong>{value}</strong></div>;
}

function ChartPanel({ title, series, unit, color, t }) {
  return <div className="chart-panel"><div><strong>{title}</strong><span>{t("lastSamples")}</span></div><MiniChart series={series} unit={unit} color={color} t={t} /></div>;
}

function AlertsPage({ alerts, refresh, token, t, locale }) {
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
      <PageHeader title={t("alerts")} subtitle={t("alertsSubtitle")} />
      <div className="toolbar">
        <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
          <option value="all">All severities</option>
          {severityLabels.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={ack} onChange={(event) => setAck(event.target.value)}>
          <option value="all">All states</option>
          <option value="false">{t("unacknowledged")}</option>
          <option value="true">Acknowledged</option>
        </select>
      </div>
      <section className="panel">
        <AlertList alerts={filtered} onAck={acknowledge} t={t} locale={locale} />
      </section>
    </>
  );
}

function AlertList({ alerts, onAck, dense = false, t, locale }) {
  const sorted = [...alerts].sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
  return (
    <div className={`alert-list ${dense ? "dense" : ""}`}>
      {sorted.map((alert) => (
        <article className="alert-row" key={alert.id}>
          <Badge tone={alert.severity}>{alert.severity}</Badge>
          <div>
            <strong>{alert.title}</strong>
            <p>{alert.message}</p>
            <span>{alert.asset?.name || alert.assetId} · {formatTime(alert.createdAt, locale)}</span>
          </div>
          {onAck && !alert.acknowledged ? <button onClick={() => onAck(alert.id)}>{t("ack")}</button> : <small>{alert.acknowledged ? t("acknowledged") : t("open")}</small>}
        </article>
      ))}
    </div>
  );
}

function SettingsPage({ t }) {
  return (
    <>
      <PageHeader title={t("settings")} subtitle={t("settingsSubtitle")} />
      <section className="panel settings-panel">
        <h2>{t("metricsProvider")}</h2>
        <p>{t("metricsProviderText")} <strong>MockMetricsProvider</strong>. {t("metricsProviderHelp")}</p>
        <div className="config-list">
          <span>{t("apiBase")}</span><code>{API_BASE}</code>
          <span>{t("authMode")}</span><code>{t("authModeValue")}</code>
          <span>{t("polling")}</span><code>{t("pollingValue")}</code>
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
  const { locale, setLocale, t } = useI18n();

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
    if (page === "assets") return <AssetsPage assets={assets} selectedAsset={selectedAsset} setSelectedAsset={setSelectedAsset} token={token} t={t} locale={locale} />;
    if (page === "alerts") return <AlertsPage alerts={alerts} refresh={refresh} token={token} t={t} locale={locale} />;
    if (page === "settings") return <SettingsPage t={t} />;
    return <Dashboard assets={assets} alerts={alerts} onSelectAsset={(id) => { setSelectedAsset(id); setPage("assets"); }} t={t} locale={locale} />;
  }, [page, assets, alerts, selectedAsset, token, t, locale]);

  if (!token) {
    return <Login onLogin={(nextToken, nextUser) => { setToken(nextToken); setUser(nextUser); }} t={t} locale={locale} setLocale={setLocale} />;
  }

  return (
    <Shell
      page={page}
      setPage={setPage}
      user={user}
      t={t}
      locale={locale}
      setLocale={setLocale}
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
