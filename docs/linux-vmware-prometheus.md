# Giám sát trực tiếp Linux VM bằng Prometheus

Luồng dữ liệu:

```txt
Linux VM node_exporter :9100
  -> Prometheus :9090
  -> Network Monitor backend :4000
  -> React dashboard :5173
```

## 1. Lấy IP của Linux VM

Trên Linux VM:

```bash
ip addr
```

Ví dụ IP VM là `192.168.1.50`.

Máy đang chạy website phải truy cập được:

```bash
curl http://192.168.1.50:9100/metrics
```

Nếu không truy cập được, kiểm tra VMware network mode. Dễ nhất cho lab là dùng **Bridged** để VM cùng mạng LAN với máy host.

## 2. Cài node_exporter trên Linux VM

Ubuntu/Debian:

```bash
sudo useradd --no-create-home --shell /usr/sbin/nologin node_exporter
cd /tmp
wget https://github.com/prometheus/node_exporter/releases/download/v1.8.2/node_exporter-1.8.2.linux-amd64.tar.gz
tar xzf node_exporter-1.8.2.linux-amd64.tar.gz
sudo cp node_exporter-1.8.2.linux-amd64/node_exporter /usr/local/bin/
sudo chown node_exporter:node_exporter /usr/local/bin/node_exporter
```

Tạo service:

```bash
sudo tee /etc/systemd/system/node_exporter.service >/dev/null <<'EOF'
[Unit]
Description=Prometheus Node Exporter
After=network-online.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now node_exporter
sudo systemctl status node_exporter
```

Mở firewall nếu cần:

```bash
sudo ufw allow 9100/tcp
```

## 3. Chạy Prometheus

Sửa `prometheus.yml` trong project, thay target thành IP VM thật:

```yaml
targets:
  - 192.168.1.50:9100
```

Chạy Prometheus bằng Docker trên máy host:

```bash
docker run --rm -p 9090:9090 -v "%cd%/prometheus.yml:/etc/prometheus/prometheus.yml" prom/prometheus
```

PowerShell:

```powershell
docker run --rm -p 9090:9090 -v "${PWD}/prometheus.yml:/etc/prometheus/prometheus.yml" prom/prometheus
```

Mở:

```txt
http://localhost:9090/targets
```

Target `192.168.1.50:9100` phải ở trạng thái `UP`.

## 4. Chạy website dùng Prometheus

PowerShell:

```powershell
$env:PROMETHEUS_URL="http://localhost:9090"
$env:LINUX_SERVER_IP="192.168.1.50"
$env:LINUX_SERVER_INSTANCE="192.168.1.50:9100"
npm run dev
```

Nếu chạy backend riêng:

```powershell
$env:PROMETHEUS_URL="http://localhost:9090"
$env:LINUX_SERVER_IP="192.168.1.50"
$env:LINUX_SERVER_INSTANCE="192.168.1.50:9100"
npm run server
```

Sau đó đăng nhập website và chọn asset **Linux VMware Server**.

## 5. Metrics đang đọc

- CPU: `node_cpu_seconds_total`
- RAM: `node_memory_MemAvailable_bytes`, `node_memory_MemTotal_bytes`
- Disk `/`: `node_filesystem_avail_bytes`, `node_filesystem_size_bytes`
- Uptime: `node_boot_time_seconds`
- Network traffic: `node_network_receive_bytes_total`, `node_network_transmit_bytes_total`
