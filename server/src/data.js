export const severities = ["OK", "INFO", "WARNING", "HIGH", "CRITICAL"];

export const assets = [
  {
    id: "linux-vm-01",
    name: process.env.LINUX_SERVER_NAME || "Linux VMware Server",
    type: "server",
    ip: process.env.LINUX_SERVER_IP || "192.168.1.50",
    prometheusInstance: process.env.LINUX_SERVER_INSTANCE || "192.168.1.50:9100",
    location: "VMware",
    status: "online",
    severity: "OK",
    tags: ["linux", "vmware", "node-exporter"],
    services: ["node-exporter", "ssh"]
  },
  {
    id: "srv-core-01",
    name: "Core App Server 01",
    type: "server",
    ip: "10.10.1.11",
    location: "DC Bangkok / Rack A3",
    status: "online",
    severity: "WARNING",
    tags: ["linux", "production"],
    services: ["nginx", "postgres-exporter", "node-exporter"]
  },
  {
    id: "srv-db-01",
    name: "Database Primary",
    type: "server",
    ip: "10.10.1.21",
    location: "DC Bangkok / Rack B1",
    status: "online",
    severity: "HIGH",
    tags: ["postgresql", "critical"],
    services: ["postgresql", "backup-agent", "node-exporter"]
  },
  {
    id: "rtr-edge-01",
    name: "Edge Router 01",
    type: "router",
    ip: "10.10.0.1",
    location: "WAN Edge",
    status: "online",
    severity: "CRITICAL",
    tags: ["wan", "bgp"],
    interfaces: ["ge-0/0/0", "ge-0/0/1", "xe-0/1/0"]
  },
  {
    id: "sw-access-07",
    name: "Access Switch 07",
    type: "switch",
    ip: "10.10.7.2",
    location: "Office Floor 7",
    status: "degraded",
    severity: "WARNING",
    tags: ["office", "poe"],
    interfaces: ["gi1/0/1", "gi1/0/24", "te1/1/1"]
  },
  {
    id: "fw-perimeter-01",
    name: "Perimeter Firewall",
    type: "firewall",
    ip: "10.10.0.254",
    location: "WAN Edge",
    status: "online",
    severity: "OK",
    tags: ["security", "vpn"],
    interfaces: ["wan1", "dmz1", "lan1"]
  },
  {
    id: "svc-checkout",
    name: "Checkout API",
    type: "service",
    ip: "https://checkout.internal",
    location: "Kubernetes",
    status: "online",
    severity: "INFO",
    tags: ["http", "customer-facing"],
    services: ["http", "tls", "synthetic-check"]
  }
];

export const alerts = [
  {
    id: "alt-1001",
    assetId: "rtr-edge-01",
    severity: "CRITICAL",
    title: "WAN packet loss above 12%",
    message: "BGP edge path is dropping packets on xe-0/1/0.",
    acknowledged: false,
    createdAt: "2026-05-11T02:15:00.000Z"
  },
  {
    id: "alt-1002",
    assetId: "srv-db-01",
    severity: "HIGH",
    title: "Database disk usage above 86%",
    message: "Primary volume is growing faster than the last 24h baseline.",
    acknowledged: false,
    createdAt: "2026-05-11T03:03:00.000Z"
  },
  {
    id: "alt-1003",
    assetId: "sw-access-07",
    severity: "WARNING",
    title: "PoE budget near limit",
    message: "Switch PoE utilization is above 78%.",
    acknowledged: true,
    createdAt: "2026-05-10T22:40:00.000Z"
  },
  {
    id: "alt-1004",
    assetId: "srv-core-01",
    severity: "WARNING",
    title: "CPU load sustained above 75%",
    message: "Application workers are close to saturation.",
    acknowledged: false,
    createdAt: "2026-05-11T01:28:00.000Z"
  },
  {
    id: "alt-1005",
    assetId: "svc-checkout",
    severity: "INFO",
    title: "TLS certificate expires in 21 days",
    message: "Schedule certificate rotation before the next release window.",
    acknowledged: false,
    createdAt: "2026-05-10T19:12:00.000Z"
  }
];
