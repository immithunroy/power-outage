# ⚡ Outage Watch — Loadshedding / Power Outage Monitor

A self-hosted **MERN** web app that continuously pings a grid-powered host. If the
host answers → grid is available. If it stops answering → the grid is down
(loadshedding), and an outage is recorded automatically.

Public dashboard: `outage.qbinternet.com`
Admin panel:      `outage.qbinternet.com/admin`

## Features

- **Live status** — grid up/down in real time, with last-check time, latency and
  an elapsed timer while an outage is running.
- **Reports** — outage **count** and **total downtime** for rolling **Daily
  (last 24h), Weekly (7d), Monthly (30d), Quarterly (13 weeks)** periods (plus
  "all time"), with availability percentage, longest & average outage.
- **Beautiful infographics** — animated gauges, availability donuts, per-bucket
  outage charts and a 24h up/down timeline.
- **Auto-detection** — flexible target: ICMP ping **or** TCP connect (host + port),
  configurable interval and consecutive-fails threshold to avoid false alarms.
- **Growatt inverter integration** — real-time solar, grid, load and battery
  monitoring via Growatt Open API V1. Power flow visualization, battery SOC,
  backup runtime estimation, energy history charts.
- **Admin panel** (password protected) — change ping destination host/IP, method,
  port, interval, thresholds; test the probe; clear history; export CSV;
  change admin password; configure Growatt integration.
- **English / বাংলা language switcher** and **dark / light theme**.
- **Responsive design** — works on phone, tablet and desktop.
- Public JSON APIs so you can integrate with other tools.

## Tech Stack

- **M**ongoDB (data: pings, outages, settings)
- **E**xpress (REST API + pinger service)
- **R**eact + Vite (dashboard) + Recharts (charts)
- **N**ode.js
- Docker (nginx serves the SPA and reverse-proxies `/api`, `/admin` handled by
  the React router)

## Quick Start

```bash
cd C:\projects\outage
cp .env.example .env     # edit ADMIN_PASSWORD, JWT_SECRET, TZ, HTTP_PORT
docker compose up -d --build
```

Then open `http://<server-ip>:8030/` to verify. The app serves plain HTTP on
host port `HTTP_PORT` (default `8030`). HTTPS/SSL is **not** part of this app —
terminate TLS externally with your own reverse proxy (e.g. Nginx Proxy Manager)
and forward `outage.qbinternet.com` to `http://127.0.0.1:8030`.

## Admin

Open `/admin`, enter the admin password (default `AdMin@123`, change it after
first login via **Admin → Change password**). Configure:

| Setting        | Meaning                                                        |
|----------------|----------------------------------------------------------------|
| Target         | Grid-only host / IP to probe (AC powered, e.g. a gateway device)|
| Generator host | Host powered by the generator (e.g. a camera). Generator counts as running when the grid is down but this host still replies |
| IPS host       | Host on the IPS backup (e.g. a router). Shown live on the dashboard |
| Method         | `ping` (ICMP) or `tcp` (raw TCP connect)                       |
| Port           | For `tcp` method (e.g. 443, 80)                                |
| Interval       | Seconds between probes (min 5)                                 |
| Confirm down   | Consecutive failures before an outage is declared              |
| Confirm up     | Consecutive successes before recovery is declared              |

Pick a target that is **on the grid** (a Wi-Fi router, a gateway device, a VPS
hosted in the office) so it vanishes when grid power is cut.

## API Overview

| Endpoint                           | Method | Auth | Description                          |
|------------------------------------|--------|------|--------------------------------------|
| `/api/status`                      | GET    | no   | Current status + live metrics        |
| `/api/stats?period=day`            | GET    | no   | Reports (`day`/`week`/`month`/`quarter`/`all`) |
| `/api/timeline?hours=24`           | GET    | no   | Ping buckets for the timeline chart  |
| `/api/history?limit=20`            | GET    | no   | Recent outage events                 |
| `/api/history/export`              | GET    | yes  | CSV of all outages                   |
| `/api/settings`                    | GET    | yes  | Current probe settings               |
| `/api/settings`                    | POST   | yes  | Update probe settings                |
| `/api/settings/test`               | POST   | yes  | Test the probe right now             |
| `/api/settings/password`           | POST   | yes  | Change admin password                |
| `/api/settings/clear-history`      | POST   | yes  | Delete all pings & outages           |
| `/api/auth/login`                  | POST   | no   | Login → JWT                          |
| `/api/growatt/status`              | GET    | no   | Real-time solar/grid/load/battery    |
| `/api/growatt/energy?period=week`  | GET    | no   | Energy history (`day`/`week`/`month`) |
| `/api/growatt/alarms`              | GET    | no   | Inverter faults and warnings         |
| `/api/growatt/settings`            | GET    | yes  | Growatt integration settings         |
| `/api/growatt/settings`            | POST   | yes  | Update Growatt settings              |
| `/api/growatt/test`                | POST   | yes  | Test Growatt API connection          |
| `/api/growatt/discover`            | POST   | yes  | Discover plants and devices          |

## Local Development

```bash
# backend
cd backend
npm install
npm run dev          # requires a MongoDB (e.g. mongodb://localhost:27017/outage)

# frontend
cd frontend
npm install
npm run dev          # http://localhost:5173, proxies /api to :5000
```

## Project Layout

```
outage/
├─ docker-compose.yml          # mongo + backend + frontend(nginx)
├─ backend/                    # Express API + pinger + stats engine
│  └─ src/
│     ├─ server.js
│     ├─ models/               # Setting, Outage, Ping, GrowattSetting
│     ├─ services/             # pinger, statsService, growattService
│     └─ routes/               # auth, status, stats, settings, growatt
└─ frontend/                   # React + Vite SPA (dashboard + admin + power)
   └─ src/
      ├─ pages/                # Home, Power, Admin
      ├─ components/           # Navbar, StatusHero, Charts, PowerFlow, BatteryStatus, ...
      ├─ context/              # locale + theme
      └─ i18n/                 # en / bn translations
```

## Notes

- Ping records auto-expire after 3 days (kept for the 24h timeline). All reports
  are computed from persistent outage events, so history is never lost.
- `TZ` controls report day boundaries (set `Asia/Dhaka` for Bangladesh).
- ICMP works from Docker by default; if your host blocks ICMP for containers,
  switch the probe method to `tcp` in the admin panel.