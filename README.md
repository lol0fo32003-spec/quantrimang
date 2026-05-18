# Network Monitor MVP

MVP website giám sát mạng kiểu Zabbix, gồm React frontend và Node/Express backend với mock metrics adapter.

## Chạy local

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## Tài khoản mặc định

- Username: `admin`
- Password: `admin123`

Có thể đổi bằng biến môi trường:

```bash
ADMIN_USER=your_user ADMIN_PASSWORD=your_password JWT_SECRET=your_secret npm run server
```

## API chính

- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/assets`
- `GET /api/assets/:id`
- `GET /api/assets/:id/metrics`
- `GET /api/alerts`
- `POST /api/alerts/:id/ack`

Mặc định hệ thống dùng `MockMetricsProvider`. File `server/src/metricsProvider.js` có sẵn lớp `PrometheusMetricsProvider` placeholder để nối Prometheus sau.

## Giám sát Linux VM thật

Project đã có Prometheus adapter cho `node_exporter`. Xem hướng dẫn chi tiết tại:

[docs/linux-vmware-prometheus.md](docs/linux-vmware-prometheus.md)

Tóm tắt:

```powershell
$env:PROMETHEUS_URL="http://localhost:9090"
$env:LINUX_SERVER_IP="192.168.1.50"
$env:LINUX_SERVER_INSTANCE="192.168.1.50:9100"
npm run dev
```
