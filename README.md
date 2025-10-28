<div align="center">
  <img src="admin_frontend/src/assets/logo_notext.png" alt="Sentra" width="72" height="72" />
  
  <h1>Sentra – LPR Parking System</h1>
  <p>A modern, admin‑friendly parking management platform powered by License Plate Recognition.</p>
</div>

## Overview

This repository contains the UI and server for an LPR‑based (License Plate Recognition) parking system. The admin web app provides a clean dashboard for tracking occupancy, revenue, and live camera feeds across multiple facilities.

Key admin screens implemented:
- Facilities landing – list of parking facilities with capacity meter and quick revenue tag.
- Facility dashboard – at‑a‑glance cards (occupied/total, vehicles today, revenue today) + parking map.
- In & Out – table of recent entries/exits with duration and amount.
- Live feed – tiled camera layout alongside the parking map.

> Note: LPR inference and backend APIs are WIP and will be integrated into the admin UI when available.

## Monorepo structure

```
lpr-parking-system/
├─ admin_frontend/     # React + Vite + Tailwind v4 admin application
├─ admin_backend/      # Backend service (API/LPR pipeline) – WIP
├─ LICENSE
└─ README.md
```

### Tech stack
- React 19 + Vite 7
- React Router
- Tailwind CSS v4 (design tokens via `@theme`)

## Getting started

Prerequisites
- Node.js 18+ (LTS recommended)

Install and run the admin frontend
1. Open a terminal at the repo root
2. Change into the frontend app
	```bash
	cd admin_frontend
	```
3. Install dependencies
	```bash
	npm install
	```
4. Start the dev server
	```bash
	npm run dev
	```
5. Open http://localhost:5173 in your browser.

### Available scripts (frontend)
- `npm run dev` – start Vite dev server
- `npm run build` – build for production
- `npm run preview` – preview the built app locally
- `npm run lint` – run ESLint

## App navigation
Routes currently available in the admin app:

- `/` – Marketing/landing page (hero + features)
- `/signin` – Sign in
- `/signup` – Sign up
- `/admin` – Facilities landing
- `/admin/:facilityId` – Facility dashboard
- `/admin/:facilityId/inout` – In & Out
- `/admin/:facilityId/live` – Live feed

## Screenshots

If you’re viewing this on GitHub, you can find UI mocks in the PR/issue thread. To add screenshots here later, drop images under `docs/screenshots/` and reference them:

```
docs/
  screenshots/
	 facilities.png
	 dashboard.png
	 inout.png
	 livefeed.png
```

## Backend (WIP)

The `admin_backend/` folder will expose APIs for facilities, sessions (in/out), and camera/LPR events. Until the API is ready, the UI uses static/dummy data for demonstration purposes.

## Contributing
Pull requests are welcome! Please open an issue first to discuss major changes. Keep the UI consistent with the existing design tokens (`sentraBlack`, `sentraGray`, `sentraYellow`).

## License
This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.

