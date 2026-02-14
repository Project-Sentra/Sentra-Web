<div align="center">
  <img src="admin_frontend/src/assets/logo_notext.png" alt="Sentra" width="72" height="72" />

  <h1>Sentra - LPR Parking System</h1>
  <p>A production-grade parking management platform powered by License Plate Recognition, supporting admin web dashboard and mobile user app.</p>
</div>

## Overview

This repository contains the **admin web application** and **REST API** for the Sentra LPR Parking System. The backend also serves the mobile app (separate repo). It has two components:

| Component | Directory | Tech |
|-----------|-----------|------|
| **Admin Dashboard** (frontend) | `admin_frontend/` | React 19, Vite 7, Tailwind CSS v4 |
| **REST API** (backend) | `admin_backend/` | Python 3.10+, Flask, Supabase |

The system manages multi-facility parking operations, vehicle registration, reservations, subscriptions, wallet payments, and integrates with the separate **SentraAI-model** service for real-time license plate detection.

### Key Features

- **Multi-Facility Support** - Manage multiple parking facilities with independent spots, floors, and pricing
- **Real-time Occupancy Monitoring** - Live parking map with auto-polling
- **Automated Billing** - Hourly pricing with wallet auto-pay and subscription support
- **Vehicle Registration** - Users register vehicles; LPR checks registration status on entry
- **Advance Reservations** - Book spots with QR code for check-in
- **Subscription Plans** - Monthly passes with auto-renew, parking fee waived for subscribers
- **Wallet System** - Top-up wallet, automatic payment deduction on exit
- **Gate Control** - Entry/exit gates with manual open/close and audit logging
- **Smart Entry/Exit** - Auto-assigns spots; reservation > subscription > walk-in priority
- **WebSocket Integration** - Instant plate detection events from SentraAI
- **Push Notifications** - In-app notifications for entry, exit, reservations, payments
- **Role-based Access** - Admin, operator, and user roles
- **JWT Authentication** - Supabase Auth with bcrypt password hashing
- **Mobile App Support** - Same API serves the Flutter mobile app

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Tailwind CSS v4, Axios, React Router v7 |
| Backend | Python 3.10+, Flask, Flask-CORS, httpx |
| Database | Supabase (hosted PostgreSQL) with RLS |
| Auth | Supabase Auth (JWT + bcrypt) |
| AI Integration | SentraAI Model API (separate service, port 5001) |
| Mobile | Flutter (separate repo, shares backend API) |
| Deployment | Docker, GitHub Actions CI/CD, AWS EC2 |

## Database Schema (v2.0)

The system uses 16 database tables:

| Table | Purpose |
|-------|---------|
| `users` | User accounts with roles (admin/user/operator) |
| `vehicles` | Registered vehicles with plate, make, model, color |
| `facilities` | Parking facilities with address, capacity, pricing |
| `floors` | Floors within facilities |
| `parking_spots` | Individual spots with type (regular/handicapped/ev/vip) |
| `pricing_plans` | Pricing plans (hourly/daily/monthly/reservation) |
| `reservations` | Advance bookings with QR codes and status tracking |
| `parking_sessions` | Active and historical parking sessions |
| `user_wallets` | User wallet balances for auto-payment |
| `payments` | Payment records for sessions, top-ups, subscriptions |
| `subscriptions` | Monthly pass subscriptions with auto-renew |
| `cameras` | Camera configurations linked to facilities and gates |
| `gates` | Entry/exit gates with hardware IP and status |
| `detection_logs` | LPR detection events with confidence scores |
| `gate_events` | Gate open/close audit log |
| `notifications` | User notifications (entry, exit, payment, reservation) |

See `admin_backend/supabase_schema.sql` for the complete schema with indexes and RLS policies.

## Prerequisites

1. **Node.js** v18+ - [nodejs.org](https://nodejs.org/)
2. **Python** v3.10+ - [python.org](https://www.python.org/)
3. **Supabase Account** (free tier works) - [supabase.com](https://supabase.com)

> **First time?** See the [Complete Setup Guide](SETUP_GUIDE.md) for detailed, beginner-friendly instructions.

## Quick Start Guide

### Step 1: Clone the Repository

```bash
git clone https://github.com/Project-Sentra/lpr-parking-system.git
cd lpr-parking-system
```

### Step 2: Database Setup (Supabase)

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `admin_backend/supabase_schema.sql`
3. Copy your **Project URL** and **anon public key** from Project Settings > API

### Step 3: Backend Setup

```bash
cd admin_backend

# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
copy .env.example .env       # Windows
# cp .env.example .env       # macOS/Linux
```

Edit `.env` with your Supabase credentials:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-supabase-anon-key
```

```bash
# Seed default facility + 32 spots + pricing plans
python reset_db.py --seed-only

# Start the Flask development server
python app.py
# Server starts on http://127.0.0.1:5000
```

### Step 4: Frontend Setup

Open a **new terminal** (keep the backend running):

```bash
cd admin_frontend
npm install
npm run dev
# Dev server starts on http://localhost:5173
```

### Step 5: Access the Application

1. Open **http://localhost:5173** in your browser
2. Create an account at `/signup`
3. Sign in at `/signin`
4. You'll land on the **Facilities** page - click a facility to open the Dashboard

## Testing Without Cameras

You can test the full system without the SentraAI service or physical cameras:

```bash
# Vehicle Entry
curl -X POST http://127.0.0.1:5000/api/sessions/entry \
  -H "Content-Type: application/json" \
  -d '{"plate_number": "WP CA-1234", "facility_id": 1}'

# Vehicle Exit
curl -X POST http://127.0.0.1:5000/api/sessions/exit \
  -H "Content-Type: application/json" \
  -d '{"plate_number": "WP CA-1234"}'
```

The dashboard will update automatically via polling.

## API Endpoints (v2.0)

The API has 60+ endpoints organized into 15 groups:

| Group | Endpoints | Auth |
|-------|-----------|------|
| Auth | signup, login, profile | Public / Protected |
| Admin Users | list, get, update | Admin |
| Vehicles | CRUD, lookup by plate | Protected / Public |
| Facilities | CRUD with live occupancy | Public / Admin |
| Parking Spots | list, init, update | Public / Admin |
| Reservations | create, list, cancel | Protected |
| Sessions | entry, exit, history | Public / Protected |
| Payments & Wallet | balance, topup, history | Protected |
| Subscriptions | purchase, list, cancel | Protected |
| Cameras | CRUD | Admin |
| Gates | CRUD, open/close | Admin |
| Detection Logs | CRUD, approve/reject | Admin / Public |
| Notifications | list, mark read | Protected |
| Dashboard Stats | occupancy, revenue, entries | Admin |
| System | reset, LPR health check | Admin |

> See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for full request/response details.

### Backward Compatibility

All v1 endpoints (`/api/signup`, `/api/login`, `/api/spots`, `/api/vehicle/entry`, etc.) are still supported via aliases to the new v2 endpoints.

## Architecture

```
+--------------+    WebSocket     +--------------+    HTTP     +---------------+
|  React App   |<--------------->|  SentraAI    |------------>|  Flask API    |
|  (port 5173) |                 |  (port 5001) |            |  (port 5000)  |
+--------------+                 +--------------+            +-------+-------+
       |                                                             |
       |              HTTP (authenticated)                           |
       +-------------------------------------------------------------+
                                                                     |
+--------------+                                              +------v------+
| Mobile App   |------- HTTP (authenticated) ---------------->|  Supabase   |
| (Flutter)    |                                              | (PostgreSQL)|
+--------------+                                              +-------------+
```

**Entry/Exit Flow:**
1. **SentraAI** detects a license plate from camera feed
2. **WebSocket** pushes detection event to the React frontend
3. **Operator** confirms entry/exit via modal dialog (or auto-approved if registered)
4. **Flask backend** checks reservation > subscription > walk-in, assigns spot
5. On exit: calculates fee, auto-deducts from wallet if sufficient
6. **Dashboard** updates in real-time via polling

## Project Structure

```
lpr-parking-system/
|
+-- admin_backend/                  # Flask REST API (v2.0)
|   +-- app.py                      # Flask app init + Supabase connection
|   +-- routes.py                   # All API endpoints (60+ across 15 groups)
|   +-- reset_db.py                 # Database reset + seed script
|   +-- supabase_schema.sql         # Database schema (16 tables, v2.0)
|   +-- requirements.txt            # Python dependencies
|   +-- .env.example                # Template for environment variables
|   +-- Dockerfile                  # Multi-stage production Docker build
|
+-- admin_frontend/                 # React SPA (Single Page Application)
|   +-- src/
|   |   +-- App.jsx                 # Route definitions (11 routes)
|   |   +-- main.jsx                # React DOM mount point
|   |   +-- index.css               # Tailwind config + custom theme
|   |   |
|   |   +-- pages/
|   |   |   +-- Home.jsx            # Public landing page
|   |   |   +-- SignIn.jsx          # Login form
|   |   |   +-- SignUp.jsx          # Registration form
|   |   |   +-- admin/
|   |   |       +-- Facilities.jsx  # Facility selection grid (live data)
|   |   |       +-- Dashboard.jsx   # Live overview: spots, map, stats
|   |   |       +-- InOut.jsx       # Entry/exit log table + mini map
|   |   |       +-- LiveFeed.jsx    # Camera feeds + plate confirmation
|   |   |       +-- Users.jsx       # User management (roles, status)
|   |   |       +-- Vehicles.jsx    # Vehicle registry (search, deactivate)
|   |   |       +-- Reservations.jsx  # Reservation management
|   |   |
|   |   +-- components/
|   |   |   +-- Navbar.jsx          # Top nav bar (Home page)
|   |   |   +-- Sidebar.jsx         # Side nav (admin pages, logout)
|   |   |   +-- ParkingMap.jsx      # Visual parking grid
|   |   |   +-- CameraTile.jsx      # Single camera feed tile
|   |   |   +-- PlateConfirmModal.jsx  # Plate detection approval dialog
|   |   |   +-- FacilityCard.jsx    # Facility summary card (live occupancy)
|   |   |   +-- ProgressBar.jsx     # Percentage bar
|   |   |
|   |   +-- services/
|   |   |   +-- api.js              # Axios instance with JWT interceptor
|   |   |   +-- lprService.js       # API client (40+ methods for all endpoints)
|   |   |
|   |   +-- hooks/
|   |       +-- useWebSocket.js     # WebSocket hook for SentraAI events
|   |
|   +-- package.json
|   +-- vite.config.js
|   +-- index.html
|   +-- Dockerfile
|
+-- API_DOCUMENTATION.md            # Full API reference (v2.0)
+-- SETUP_GUIDE.md                  # Complete setup guide
+-- LICENSE
+-- README.md                       # This file
```

## Configuration

### Backend Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_KEY` | Yes | Supabase anon/public key |

### Frontend Environment Variables (optional)

Set these in a `.env` file in `admin_frontend/`:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://127.0.0.1:5000/api` | Backend API base URL |
| `VITE_WS_URL` | `ws://127.0.0.1:5001/api/ws` | SentraAI WebSocket URL |

## Running the Full System

```bash
# Terminal 1 - Backend API
cd admin_backend
venv\Scripts\activate
python app.py                    # http://127.0.0.1:5000

# Terminal 2 - Frontend
cd admin_frontend
npm run dev                      # http://localhost:5173

# Terminal 3 - AI Service (optional)
cd SentraAI-model/service
uvicorn main:app --port 5001     # http://127.0.0.1:5001
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Missing SUPABASE_URL` error | Create `.env` from `.env.example` with your credentials |
| `Port 5000 already in use` | Kill existing process or change port in `app.py` |
| `ModuleNotFoundError: flask` | Activate venv: `venv\Scripts\activate` |
| CORS errors in browser | Make sure Flask backend is running on port 5000 |
| Empty dashboard / no spots | Run `python reset_db.py` to seed data |
| WebSocket won't connect | SentraAI service must be running on port 5001 |
| Login fails | Verify email first (check inbox/spam) |

## Security Notes

- Passwords are **bcrypt-hashed** via Supabase Auth (never stored in plain text)
- All admin endpoints require a valid **JWT Bearer token**
- Role-based access: `admin`, `operator`, `user`
- Vehicle entry/exit and detection endpoints are **public** for LPR service integration
- For production: enable strict CORS origins, use HTTPS, enable Supabase RLS policies
- Never commit `.env` files (they are in `.gitignore`)

## Related Repositories

| Repository | Description |
|------------|-------------|
| [SentraAI-model](https://github.com/Project-Sentra/SentraAI-model) | License Plate Recognition AI Service |
| [Sentra-Mobile-App](https://github.com/Project-Sentra/Sentra-Mobile-App) | Flutter mobile application (uses same API) |
| [Sentra-Infrastructure](https://github.com/Project-Sentra/Sentra-Infrastructure) | AWS deployment & infrastructure as code |

## License

This project is part of the Sentra Parking System ecosystem.

---

Made with love by the Sentra Team
