import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: new URL("../.env", import.meta.url).pathname });

const databaseUrl =
  process.env.DATABASE_URL ||
  "mysql://network_monitor_app:network_monitor_pass@localhost:3306/network_monitor";

export const pool = mysql.createPool({
  uri: databaseUrl,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true
});

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(80) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(40) NOT NULL DEFAULT 'admin',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS hosts (
      id VARCHAR(160) PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      ip VARCHAR(80) NOT NULL,
      os VARCHAR(160) NULL,
      type VARCHAR(60) NOT NULL DEFAULT 'server',
      status VARCHAR(40) NOT NULL DEFAULT 'offline',
      prometheus_instance VARCHAR(160) NOT NULL UNIQUE,
      job VARCHAR(160) NULL,
      environment VARCHAR(80) NULL,
      last_error TEXT NULL,
      last_scrape_at DATETIME NULL,
      metadata JSON NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureColumn("hosts", "metadata", "JSON NULL");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS thresholds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      metric VARCHAR(80) NOT NULL UNIQUE,
      warning_value DECIMAL(10,2) NOT NULL,
      critical_value DECIMAL(10,2) NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS host_thresholds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      host_id VARCHAR(160) NOT NULL,
      metric VARCHAR(80) NOT NULL,
      warning_value DECIMAL(10,2) NOT NULL,
      critical_value DECIMAL(10,2) NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_host_metric (host_id, metric),
      CONSTRAINT fk_host_thresholds_host FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      host_id VARCHAR(160) NOT NULL,
      metric VARCHAR(80) NOT NULL,
      severity VARCHAR(40) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      value DECIMAL(12,2) NULL,
      threshold_value DECIMAL(12,2) NULL,
      acknowledged TINYINT(1) NOT NULL DEFAULT 0,
      acknowledged_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_alerts_host_ack (host_id, acknowledged),
      CONSTRAINT fk_alerts_host FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureColumn(table, column, definition) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );

  if (rows.length === 0) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export async function seedAdmin({ username, password }) {
  const [rows] = await pool.query("SELECT id FROM users WHERE username = ?", [username]);
  if (rows.length > 0) return;
  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')", [
    username,
    passwordHash
  ]);
}

export async function seedThresholds() {
  const defaults = [
    ["cpu", 80, 90],
    ["memory", 80, 90],
    ["disk", 85, 95],
    ["latency", 120, 250],
    ["packetLoss", 5, 10]
  ];

  for (const item of defaults) {
    await pool.query(
      `INSERT INTO thresholds (metric, warning_value, critical_value)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE metric = metric`,
      item
    );
  }
}
