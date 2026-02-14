# Sentra - Admin Frontend (React SPA)

The admin dashboard for the Sentra LPR Parking System (v2.0).
Built with **React 19**, **Vite 7**, **Tailwind CSS v4**, and **React Router v7**.

## Setup

```bash
npm install
npm run dev
# -> http://localhost:5173
```

Requires the Flask backend running on port 5000 (see `../admin_backend/`).

## Environment Variables (optional)

Create a `.env` file in this directory:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://127.0.0.1:5000/api` | Backend REST API base URL |
| `VITE_WS_URL` | `ws://127.0.0.1:5001/api/ws` | SentraAI WebSocket URL |

## Project Structure

```
src/
+-- App.jsx                     # Route definitions (React Router v7, 11 routes)
+-- main.jsx                    # React DOM mount point
+-- index.css                   # Tailwind v4 config + custom theme tokens
|
+-- pages/
|   +-- Home.jsx                # Public landing page ("/")
|   +-- SignIn.jsx              # Login form ("/signin")
|   +-- SignUp.jsx              # Registration form ("/signup")
|   +-- admin/
|       +-- Facilities.jsx      # Facility grid with live occupancy ("/admin/facilities")
|       +-- Dashboard.jsx       # Live overview per facility ("/admin/:facilityId")
|       +-- InOut.jsx           # Entry/exit log table ("/admin/in-out")
|       +-- LiveFeed.jsx        # Camera feeds + plate confirmation ("/admin/live-feed")
|       +-- Users.jsx           # User management ("/admin/users")
|       +-- Vehicles.jsx        # Vehicle registry ("/admin/vehicles")
|       +-- Reservations.jsx    # Reservation management ("/admin/reservations")
|
+-- components/
|   +-- Navbar.jsx              # Top nav bar (used on Home page)
|   +-- Sidebar.jsx             # Side nav with logout (used on admin pages)
|   +-- ParkingMap.jsx          # Visual 8x4 parking slot grid
|   +-- CameraTile.jsx          # Single camera feed tile with snapshot
|   +-- PlateConfirmModal.jsx   # Confirm/reject detected plate dialog
|   +-- FacilityCard.jsx        # Facility summary card with live occupancy
|   +-- ProgressBar.jsx         # Percentage bar component
|
+-- services/
|   +-- api.js                  # Axios instance with JWT interceptor
|   +-- lprService.js           # API client (40+ methods for all v2 endpoints)
|
+-- hooks/
    +-- useWebSocket.js         # WebSocket hook for real-time SentraAI events
```

## Routing

| Path | Page | Auth Required |
|------|------|---------------|
| `/` | Home (landing page) | No |
| `/signin` | Sign In | No |
| `/signup` | Sign Up | No |
| `/admin/facilities` | Facility Selection (live data) | Yes |
| `/admin/users` | User Management | Yes |
| `/admin/vehicles` | Vehicle Registry | Yes |
| `/admin/reservations` | Reservation Overview | Yes |
| `/admin/:facilityId` | Dashboard (per facility) | Yes |
| `/admin/in-out` | Entry/Exit Logs | Yes |
| `/admin/live-feed` | Live Camera Feeds | Yes |

Auth state stored in `localStorage`: `accessToken`, `refreshToken`, `userId`, `userEmail`, `userRole`, `userDbId`, `userFullName`.

## Key Architecture Decisions

### API Layer (`services/api.js`)
- Axios instance with request interceptor that attaches `Authorization: Bearer <token>` from localStorage.
- All authenticated API calls go through this instance.

### API Client (`services/lprService.js`)
- 40+ methods organized by endpoint group (facilities, vehicles, sessions, reservations, etc.)
- Talks to both the Flask backend (port 5000) and SentraAI service (port 5001).
- Methods for every v2 API endpoint.

### WebSocket (`hooks/useWebSocket.js`)
- Connects to the **SentraAI service** (port 5001), NOT the Flask backend.
- Handles `plate_detected`, `camera_status`, `processing_update` messages.
- Auto-reconnects on disconnect (5-second interval).
- Sends `ping` heartbeat every 30 seconds.

### Data Polling
- Dashboard: polls spots every 3 seconds, stats every 5 seconds.
- Facilities page: polls facility list every 10 seconds.
- InOut page: polls logs and spots every 1 second.
- This is HTTP polling, not WebSocket (WebSocket is only for camera detections).

### Styling
- Tailwind CSS v4 with `@theme` in `index.css` for custom colors.
- Dark theme by default (charcoal/slate palette).

## Admin Pages

### Facilities
- Fetches real data from `/api/facilities` with live occupancy counts.
- Search filter by name or city.
- Click a card to navigate to the facility dashboard.

### Dashboard
- Uses `useParams()` to get facility ID from URL.
- Fetches stats from `/api/dashboard/stats` (revenue, entries, occupancy).
- Polls parking spots for the live parking map.
- Facility-scoped system reset.

### Users
- Table of all users with role filter (All/Admin/User/Operator).
- Inline role change dropdown.
- Activate/deactivate toggle.

### Vehicles
- Table of all registered vehicles with owner info.
- Search by plate number, owner name, or make.
- Deactivate button with confirmation.

### Reservations
- Table of all reservations with facility, user, vehicle, and spot info.
- Status filter buttons (All/Pending/Confirmed/Checked In/Completed/Cancelled).
- Cancel action for pending/confirmed reservations.

### Sidebar
- Shows admin's real name from `localStorage`.
- Navigation: Dashboard, In/Out, Live Feed, Facilities, Users, Vehicles, Reservations.
- Logout button that clears `localStorage` and redirects to sign-in.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

## Docker

```bash
docker build -t sentra-frontend .
docker run -p 80:80 sentra-frontend
```

Uses multi-stage build: Node for building -> nginx for serving.

## Notes

- **InOut and LiveFeed pages** still use v1 API calls (`/api/logs`, `/api/spots`, `/api/detection-logs`) which work through backward compatibility aliases in `routes.py`.
