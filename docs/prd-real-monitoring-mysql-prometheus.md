# PRD: Real Monitoring With MySQL And Prometheus

## Problem Statement

The current Network Monitor MVP has a working React/Vite frontend and Express backend, but it is still partly demo-oriented. Authentication is configured through environment variables, monitored hosts are not persisted in a database, alert state is not durable, and the dashboard depends on live or mock data paths without a normalized storage model. The user wants a real deployment on the current Ubuntu server using MySQL and live Prometheus data rather than mock data.

## Solution

Implement a production-shaped MVP that stores application data in MySQL, authenticates an admin user from the database, synchronizes monitored hosts from Prometheus targets, retrieves host metrics from Prometheus HTTP API, evaluates thresholds to create alerts, persists alert acknowledgement, and renders login, dashboard, host management, host detail, and alerts in the existing web UI.

The system should run directly on the remote Ubuntu server, using the existing Node.js/npm runtime, existing MySQL service, and existing Prometheus endpoint.

## User Stories

1. As an admin, I want to log in with a username and password, so that only authorized users can access monitoring data.
2. As an admin, I want invalid credentials to be rejected, so that unauthorized users cannot access the dashboard.
3. As an admin, I want my login session to persist with a token, so that I do not need to log in after every page refresh.
4. As an admin, I want to log out, so that I can end my session.
5. As an admin, I want the app to redirect me to the dashboard after successful login, so that I can immediately view system status.
6. As an admin, I want users stored in MySQL, so that admin credentials are not only environment variables.
7. As an admin, I want the dashboard to show total monitored hosts, so that I can quickly understand monitoring scope.
8. As an admin, I want the dashboard to show online and offline host counts, so that I can quickly identify reachability issues.
9. As an admin, I want the dashboard to show open alert counts, so that I can prioritize incidents.
10. As an admin, I want the dashboard to show current CPU, RAM, Disk, and Network summaries, so that I can identify resource pressure without opening each host.
11. As an admin, I want the host list to show monitored hosts from Prometheus, so that the UI reflects real infrastructure.
12. As an admin, I want each host row to show name, IP, OS, and status, so that I can scan host health efficiently.
13. As an admin, I want to filter hosts by type and status, so that I can focus on relevant infrastructure.
14. As an admin, I want to search hosts by name or IP, so that I can find a specific machine quickly.
15. As an admin, I want to select a host, so that I can view its detailed metrics.
16. As an admin, I want host details to show basic host information, so that I know which machine I am inspecting.
17. As an admin, I want host details to show uptime, load average, and connection status, so that I can understand host reliability.
18. As an admin, I want host details to show CPU history, so that I can detect load trends.
19. As an admin, I want host details to show RAM history, so that I can detect memory pressure.
20. As an admin, I want host details to show Disk history, so that I can detect storage pressure.
21. As an admin, I want host details to show Network traffic history, so that I can detect traffic anomalies.
22. As an admin, I want the backend to query Prometheus HTTP API, so that metrics come from real exporters.
23. As an admin, I want the backend to normalize Prometheus responses, so that the frontend receives stable JSON regardless of Prometheus result shape.
24. As an admin, I want hosts synchronized from Prometheus targets into MySQL, so that the app has persistent host records.
25. As an admin, I want alert thresholds stored in MySQL, so that threshold configuration is durable.
26. As an admin, I want the backend to evaluate metrics against thresholds, so that alerts are generated automatically.
27. As an admin, I want generated alerts to include severity, metric, current value, and threshold value, so that I can understand the cause.
28. As an admin, I want alerts shown in the web UI, so that I can monitor active incidents.
29. As an admin, I want to acknowledge alerts, so that I can mark incidents as handled.
30. As an admin, I want acknowledgement stored in MySQL, so that alert state survives server restarts.
31. As an operator, I want clear environment variables for MySQL and Prometheus, so that deployment is repeatable.
32. As an operator, I want startup database migration for MVP tables, so that the app can initialize the schema on the Ubuntu server.
33. As an operator, I want seed data for the default admin and thresholds, so that the system is usable immediately after deployment.
34. As an operator, I want API health checks, so that I can verify the backend is running.
35. As an operator, I want build and runtime verification, so that deployment failures are caught before handoff.

## Implementation Decisions

- Use the existing Express backend and React/Vite frontend instead of replacing the stack.
- Use the existing MySQL service on Ubuntu 24.04.
- Use a dedicated MySQL database named `network_monitor`.
- Use a dedicated MySQL user for the application rather than connecting as root.
- Store application credentials in a `users` table with hashed passwords.
- Keep JWT authentication for API sessions.
- Add database-backed tables for users, hosts, thresholds, and alerts.
- Synchronize hosts from Prometheus active targets. Prometheus remains the source of truth for monitored target discovery; MySQL stores the normalized host records used by the app.
- Use Prometheus target health to determine online/offline state.
- Use Prometheus `node_exporter` metrics for CPU, memory, disk, uptime, load average, and network traffic.
- Normalize Prometheus instant and range query results in a metrics provider module with a stable frontend-facing shape.
- Generate alerts from threshold evaluation in backend code. Alerts are persisted and de-duplicated by host, metric, and open acknowledgement state.
- Keep alert acknowledgement as an API operation that updates MySQL.
- Preserve the existing API route names where possible to reduce frontend churn.
- Extend frontend host rows to include OS information.
- Extend dashboard cards to include quick current CPU, RAM, Disk, and Network summaries from live Prometheus metrics.
- Keep multilingual UI support as a frontend concern using the existing in-app translation table.

Major modules to build or modify:

- Database module: connection pool, schema migration, admin seed, default threshold seed.
- Auth module or route logic: database-backed admin lookup and password verification.
- Prometheus metrics provider: target discovery, host info lookup, instant query normalization, range query normalization.
- Host repository/sync logic: upsert Prometheus targets into MySQL and expose normalized host records.
- Alert engine: threshold evaluation, severity calculation, alert de-duplication, acknowledgement updates.
- API routes: login, current user, hosts, host detail, host metrics, alerts, acknowledgement, dashboard summary.
- Frontend dashboard: live summary counts and CPU/RAM/Disk/Network quick metrics.
- Frontend host list/detail: OS, uptime, load average, connection status, CPU/RAM/Disk/Network charts.

Deep modules to keep testable:

- Prometheus provider: accepts PromQL and returns normalized values/series.
- Alert engine: accepts metrics and thresholds and returns alert decisions.
- Host sync service: accepts Prometheus targets and upserts normalized host records.
- Auth service: verifies credentials against stored password hashes.

## Testing Decisions

- Tests should verify external behavior and data contracts, not private implementation details.
- Auth tests should cover successful login, failed login, and protected route rejection without a token.
- Host sync tests should cover Prometheus targets being converted into normalized host rows.
- Prometheus provider tests should cover empty results, instant values, and range values using mocked Prometheus HTTP responses.
- Alert engine tests should cover OK, WARNING, CRITICAL, de-duplication of open alerts, and acknowledgement persistence.
- API tests should cover host list, host detail, metrics, alerts, and acknowledgement.
- Frontend smoke tests should cover login, dashboard rendering, host selection, chart rendering, and alert acknowledgement.
- Build verification should run for both frontend and backend runtime startup.

Current codebase has no existing automated test harness. Add focused tests around backend deep modules first, then add frontend smoke coverage if time allows.

## Out of Scope

- Multi-user role management beyond the default admin role.
- Full threshold editing UI.
- Historical metric storage in MySQL; Prometheus remains responsible for metric history.
- Production TLS, reverse proxy, domain setup, and public internet hardening.
- Distributed deployment across multiple servers.
- Notification channels such as email, Slack, Telegram, or SMS.
- Advanced Prometheus service discovery configuration.

## Further Notes

- The current Ubuntu server already has MySQL 8.0 running on localhost and Node.js 18/npm installed.
- The current Prometheus endpoint is configured as `http://192.168.31.160:9090`.
- Prometheus currently reports live targets including `192.168.31.152:9100` as up, `192.168.31.160:9100` as down, and Prometheus self metrics as up.
- The app should not fall back to mock metrics when the user has explicitly requested real data.
- Publishing this PRD to an issue tracker is blocked because no issue tracker integration or triage label configuration is available in the current context.
