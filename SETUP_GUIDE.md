# Sentra LPR Parking System – Complete Setup Guide

Step-by-step instructions to get the project running from scratch on your local machine.

---

## What You Need Before Starting

| Software | Minimum Version | Download |
|----------|----------------|----------|
| **Node.js** | v18.0.0 | [nodejs.org](https://nodejs.org/) |
| **npm** | v9.0.0 | Comes with Node.js |
| **Python** | v3.10 | [python.org](https://www.python.org/downloads/) |
| **Git** | Any recent | [git-scm.com](https://git-scm.com/) |
| **Web Browser** | Chrome / Edge / Firefox | — |

You also need a **free Supabase account** → [supabase.com](https://supabase.com)

### Verify your installations

Open a terminal (Command Prompt, PowerShell, or any terminal) and run:

```bash
node -v
# Expected: v18.x.x or higher

npm -v
# Expected: 9.x.x or higher

python --version
# Expected: Python 3.10.x or higher

git --version
# Expected: git version 2.x.x
```

If any of these fail, install the corresponding software first.

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/Project-Sentra/lpr-parking-system.git
cd lpr-parking-system
```

After cloning, you should see this folder structure:

```
lpr-parking-system/
├── admin_backend/       ← Flask REST API (Python)
├── admin_frontend/      ← React Dashboard (JavaScript)
├── README.md
├── API_DOCUMENTATION.md
└── ...
```

---

## Step 2: Create a Supabase Project

The backend stores all data in Supabase (a hosted PostgreSQL database). You need to create a project and set up the tables.

### 2.1 Create the project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account)
2. Click **"New Project"**
3. Fill in:
   - **Name:** `sentra-parking` (or any name you like)
   - **Database Password:** choose a strong password (you won't need this in the app, but save it)
   - **Region:** pick the one closest to you
4. Click **"Create new project"**
5. Wait ~2 minutes for provisioning to finish

### 2.2 Create the database tables

1. In your Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Open the file `admin_backend/supabase_schema.sql` from this repo in any text editor
4. **Copy the entire contents** and paste it into the SQL Editor
5. Click **"Run"** (or press Ctrl+Enter)
6. You should see: `Success. No rows returned` — this means all 16 tables were created:
   - `users`, `vehicles`, `facilities`, `floors`, `parking_spots`
   - `pricing_plans`, `reservations`, `parking_sessions`
   - `user_wallets`, `payments`, `subscriptions`
   - `cameras`, `gates`, `detection_logs`, `gate_events`, `notifications`

The schema also creates indexes, check constraints, and development-mode RLS policies.

### 2.3 Get your API credentials

1. In the Supabase dashboard, go to **Project Settings** (gear icon in the bottom-left)
2. Click **"API"** in the left sidebar
3. You need two values:
   - **Project URL** — looks like `https://abcdefghijk.supabase.co`
   - **anon public** key — a long string starting with `eyJ...`
4. **Copy both values** — you'll need them in Step 3

---

## Step 3: Set Up the Backend (Flask API)

### 3.1 Open a terminal and navigate to the backend folder

```bash
cd admin_backend
```

### 3.2 Create a Python virtual environment

This isolates the project's Python packages from your system Python.

**Windows (Command Prompt):**
```bash
python -m venv venv
venv\Scripts\activate
```

**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**macOS / Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

After activation, your terminal prompt should show `(venv)` at the beginning:
```
(venv) C:\Users\you\lpr-parking-system\admin_backend>
```

> **Important:** You must activate the virtual environment every time you open a new terminal to run the backend.

### 3.3 Install Python dependencies

```bash
pip install -r requirements.txt
```

This installs: Flask, Flask-CORS, Supabase client, httpx, python-dotenv, and their sub-dependencies.  
It should take about 30-60 seconds.

### 3.4 Create the environment file

The backend needs your Supabase credentials. These are stored in a `.env` file that is NOT committed to git.

**Windows (Command Prompt):**
```bash
copy .env.example .env
```

**macOS / Linux:**
```bash
cp .env.example .env
```

### 3.5 Add your Supabase credentials

Open `.env` in any text editor (VS Code, Notepad, nano, etc.) and replace the placeholder values:

```env
SUPABASE_URL=https://your-actual-project-id.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-actual-key-here
```

> **Where to find these:** Supabase Dashboard → Project Settings → API (see Step 2.4)

### 3.6 Seed the database (optional but recommended)

```bash
python reset_db.py --seed-only
```

With `--seed-only`, this creates seed data without deleting existing records:
1. Creates a default facility: **"Sentra Main Parking"**
2. Creates a ground floor with 32 parking spots (**A-01** through **A-32**)
3. Creates 4 pricing plans (hourly, daily, monthly, reservation)

Without the flag (`python reset_db.py`), it first clears all sessions, reservations, payments, etc.

You should see:
```
Connected to Supabase
Created facility: Sentra Main Parking (id=1)
Created 32 parking spots (A-01 to A-32)
Created 4 pricing plans
Done!
```

### 3.7 Start the backend server

```bash
python app.py
```

You should see:
```
Connected to Supabase: https://your-project-id.supabase.co
Server starting on http://127.0.0.1:5000 ...
 * Running on http://127.0.0.1:5000
 * Restarting with stat
 * Debugger is active!
```

**Leave this terminal open** — the backend must keep running.

### 3.8 Verify the backend is working

Open a new terminal and run:

```bash
curl http://127.0.0.1:5000/api/spots
```

Or open `http://127.0.0.1:5000/api/spots` in your browser.

- If spots were seeded, you'll see a JSON array of 32 spots
- If not seeded yet, you might get an auth error (which still proves the server is running)

---

## Step 4: Set Up the Frontend (React Dashboard)

### 4.1 Open a NEW terminal

Keep the backend terminal running. Open a second terminal.

### 4.2 Navigate to the frontend folder

```bash
cd admin_frontend
```

(Or from the project root: `cd lpr-parking-system/admin_frontend`)

### 4.3 Install Node.js dependencies

```bash
npm install
```

This installs: React, Vite, Tailwind CSS, Axios, React Router, and dev tools.  
First run takes 1-2 minutes. You'll see a `node_modules/` folder appear.

### 4.4 Start the development server

```bash
npm run dev
```

You should see:
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
  ➜  press h + enter to show help
```

**Leave this terminal open** — the frontend must keep running.

---

## Step 5: Use the Application

### 5.1 Open the app

Open your browser and go to: **http://localhost:5173**

You should see the Sentra landing page.

### 5.2 Create an admin account

1. Click **"Sign Up"** (or go to `http://localhost:5173/signup`)
2. Enter:
   - **Name** — your display name (this is stored locally only)
   - **Email** — a real email address (Supabase sends a verification link)
   - **Password** — minimum 6 characters
3. Click **"Sign Up"**
4. **Check your email inbox** (and spam folder) for a verification email from Supabase
5. Click the verification link in the email

> **Note:** If you're in development and don't want to verify email, you can disable "Confirm email" in Supabase Dashboard → Authentication → Providers → Email → toggle off "Confirm email".

### 5.3 Sign in

1. Go to `http://localhost:5173/signin`
2. Enter the email and password you registered with
3. Click **"Sign In"**
4. You'll be redirected to the **Facilities** page

### 5.4 Navigate the dashboard

After signing in, click on any facility card to enter the admin dashboard. The sidebar gives you:

| Page | What it shows |
|------|---------------|
| **Dashboard** | Live parking map, stats (occupancy, revenue, entries), recent detections |
| **In/Out** | Table of all entry/exit records with timestamps, duration, fee |
| **Live Feed** | Camera streams and plate detection (requires SentraAI service) |
| **Facilities** | Facility overview cards with real-time occupancy |
| **Users** | User management — roles, active status |
| **Vehicles** | Vehicle registry — search by plate, deactivate |
| **Reservations** | Reservation management — status filter, cancel |

---

## Step 6: Test Without Cameras

You don't need the SentraAI service or physical cameras to test parking operations. Use these API calls to simulate vehicles.

### Simulate a vehicle entering

Open a third terminal and run:

**Windows (Command Prompt):**
```bash
curl -X POST http://127.0.0.1:5000/api/sessions/entry -H "Content-Type: application/json" -d "{\"plate_number\": \"WP CA-1234\", \"facility_id\": 1}"
```

**Windows (PowerShell):**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/sessions/entry" -Method POST -ContentType "application/json" -Body '{"plate_number": "WP CA-1234", "facility_id": 1}'
```

**macOS / Linux:**
```bash
curl -X POST http://127.0.0.1:5000/api/sessions/entry \
  -H "Content-Type: application/json" \
  -d '{"plate_number": "WP CA-1234", "facility_id": 1}'
```

Expected response:
```json
{
  "message": "Vehicle WP CA-1234 parked at A-01",
  "spot": "A-01",
  "session_type": "walk_in",
  "is_registered": false,
  "gate_action": "pending"
}
```

**Check the dashboard** — the parking map will show A-01 as occupied (red) within a few seconds.

> **Note:** The old endpoints (`/api/vehicle/entry`, `/api/vehicle/exit`) still work — they are aliased to the new v2 endpoints.

### Simulate a vehicle exiting

```bash
curl -X POST http://127.0.0.1:5000/api/sessions/exit -H "Content-Type: application/json" -d "{\"plate_number\": \"WP CA-1234\"}"
```

Expected response:
```json
{
  "message": "Spot A-01 is now free!",
  "duration_minutes": 5,
  "amount": 150,
  "payment_status": "unpaid",
  "gate_action": "open"
}
```

The minimum charge is **LKR 150** (1 hour). The fee increases for longer stays at the facility's hourly rate, rounded up.

### Try multiple vehicles

```bash
curl -X POST http://127.0.0.1:5000/api/sessions/entry -H "Content-Type: application/json" -d "{\"plate_number\": \"WP AB-5678\", \"facility_id\": 1}"
curl -X POST http://127.0.0.1:5000/api/sessions/entry -H "Content-Type: application/json" -d "{\"plate_number\": \"WP KL-9012\", \"facility_id\": 1}"
curl -X POST http://127.0.0.1:5000/api/sessions/entry -H "Content-Type: application/json" -d "{\"plate_number\": \"SP GH-3456\", \"facility_id\": 1}"
```

Each vehicle gets the next available spot. Watch the dashboard map update live.

---

## Summary: What's Running

When everything is set up, you have **two terminals** running:

| Terminal | Command | URL | Purpose |
|----------|---------|-----|---------|
| Terminal 1 | `python app.py` | http://127.0.0.1:5000 | Flask REST API |
| Terminal 2 | `npm run dev` | http://localhost:5173 | React dashboard |

And optionally a third terminal for the AI service:

| Terminal | Command | URL | Purpose |
|----------|---------|-----|---------|
| Terminal 3 | `uvicorn main:app --port 5001` | http://127.0.0.1:5001 | SentraAI (separate repo) |

### URLs at a glance

| URL | What |
|-----|------|
| http://localhost:5173 | Open this in your browser |
| http://localhost:5173/signin | Login page |
| http://localhost:5173/signup | Registration page |
| http://localhost:5173/admin/facilities | Facilities page (after login) |
| http://127.0.0.1:5000/api/facilities | API: facilities list (JSON) |
| http://127.0.0.1:5000/api/sessions | API: parking sessions (JSON, needs auth) |

---

## Stopping the Project

- **Backend:** Press `Ctrl+C` in Terminal 1
- **Frontend:** Press `Ctrl+C` in Terminal 2 (then type `y` to confirm)

---

## Starting Again Later

Every time you want to run the project after the initial setup:

### Terminal 1 – Backend
```bash
cd lpr-parking-system/admin_backend
venv\Scripts\activate
python app.py
```

### Terminal 2 – Frontend
```bash
cd lpr-parking-system/admin_frontend
npm run dev
```

That's it. No need to re-install packages or reconfigure anything (unless you delete `venv/` or `node_modules/`).

---

## Troubleshooting

### Backend won't start

| Error | Fix |
|-------|-----|
| `Missing required environment variables: SUPABASE_URL and SUPABASE_KEY` | You didn't create the `.env` file, or it has empty values. See Step 3.4-3.5 |
| `ModuleNotFoundError: No module named 'flask'` | Virtual environment not activated. Run `venv\Scripts\activate` first |
| `python: command not found` | Python not installed or not in PATH. Try `python3` instead, or reinstall Python and check "Add to PATH" |
| `Address already in use: Port 5000` | Another process is using port 5000. Kill it or change the port in `app.py` |
| `Error connecting to Supabase` | Check your SUPABASE_URL and SUPABASE_KEY in `.env` are correct. No trailing spaces. |

### Frontend won't start

| Error | Fix |
|-------|-----|
| `npm: command not found` | Node.js not installed. Download from [nodejs.org](https://nodejs.org/) |
| `Cannot find module 'vite'` | Run `npm install` first |
| `EACCES: permission denied` | On macOS/Linux, don't use `sudo`. Fix npm permissions instead |
| Port 5173 in use | Another Vite server is running. Close it or run `npx vite --port 5174` |

### App loads but nothing works

| Symptom | Fix |
|---------|-----|
| Dashboard shows no spots | Run `python reset_db.py` in the backend folder (with venv activated) |
| Login fails | 1) Make sure backend is running on port 5000. 2) Did you verify your email? Check inbox/spam |
| Network error / CORS error in console | Backend is not running. Start it with `python app.py` |
| Parking map stays empty | Run `python reset_db.py` to seed default facility and spots |
| "Invalid login credentials" | Password is wrong, or the email wasn't verified yet |

---

## Optional: SentraAI Service Setup

To use real-time license plate detection (Live Feed page):

1. Clone the AI service repo: `git clone https://github.com/Project-Sentra/SentraAI-model.git`
2. Follow the setup instructions in that repo
3. Start the AI service on port 5001
4. The Live Feed page in the dashboard will auto-connect via WebSocket

Without the AI service, the Live Feed page will show "Disconnected" but everything else works fine.
