# Sentra - Admin Backend (Flask REST API)

REST API server for the Sentra LPR Parking System (v2.0).
Built with **Python 3.10+**, **Flask**, and **Supabase** (hosted PostgreSQL).

Serves both the **admin web dashboard** and the **mobile app** (Flutter, separate repo).

## Files

| File | Purpose |
|------|---------|
| `app.py` | Flask app initialization, Supabase client setup, CORS |
| `routes.py` | Route registry that imports all route modules |
| `routes_*.py` | Grouped API endpoints by domain (auth, facilities, sessions, etc.) |
| `reset_db.py` | Database reset and seed script (facility, spots, pricing plans) |
| `supabase_schema.sql` | Complete database schema v2.0 (16 tables, run in Supabase SQL Editor) |
| `requirements.txt` | Python dependencies |
| `.env.example` | Template for environment variables |
| `Dockerfile` | Multi-stage production Docker build |

## Setup

```bash
# 1. Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
copy .env.example .env         # Windows
# cp .env.example .env         # macOS/Linux
# Then edit .env with your Supabase URL and key

# 4. Seed the database (creates default facility, 32 spots, pricing plans)
python reset_db.py --seed-only

# 5. Start the server
python app.py
# -> http://127.0.0.1:5000
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Your Supabase project URL (e.g. `https://abc123.supabase.co`) |
| `SUPABASE_KEY` | Yes | Your Supabase anon/public API key |

## API Endpoint Groups (v2.0)

All routes are prefixed with `/api`.

| Group | Path Prefix | Auth | Description |
|-------|-------------|------|-------------|
| Auth | `/auth` | Public | Signup, login, profile |
| Admin Users | `/admin/users` | Admin | User management (roles, status) |
| Vehicles | `/vehicles` | Protected | Vehicle registration, lookup by plate |
| Facilities | `/facilities` | Public/Admin | CRUD with live occupancy counts |
| Parking Spots | `/facilities/:id/spots` | Public/Admin | List, init, update spots |
| Reservations | `/reservations` | Protected | Advance booking with QR codes |
| Sessions | `/sessions` | Public/Protected | Vehicle entry/exit, session history |
| Wallet | `/wallet` | Protected | Balance, top-up |
| Payments | `/payments` | Protected | Payment history |
| Subscriptions | `/subscriptions` | Protected | Monthly passes |
| Cameras | `/cameras` | Admin | Camera CRUD |
| Gates | `/gates` | Admin | Gate CRUD, open/close with audit log |
| Detections | `/detections` | Admin/Public | LPR detection logs, approve/reject |
| Notifications | `/notifications` | Protected | User notifications, mark read |
| Dashboard | `/dashboard` | Admin | Real-time stats (occupancy, revenue) |
| System | `/system` | Admin | Reset, LPR health check |

See [API_DOCUMENTATION.md](../API_DOCUMENTATION.md) for full request/response details.

## Authentication

- Uses **Supabase Auth** (JWT + bcrypt).
- `POST /api/auth/signup` calls `supabase.auth.sign_up()` and creates a row in the `users` table.
- `POST /api/auth/login` calls `supabase.auth.sign_in_with_password()` and returns tokens + user profile.
- Protected endpoints use a `@require_auth` decorator that validates the JWT via `supabase.auth.get_user(token)`.
- Admin endpoints use `@require_admin` which also checks the user's role is `admin` or `operator`.
- Three roles: `admin`, `operator`, `user`

## Entry/Exit Logic

The `/api/sessions/entry` endpoint follows this priority:

1. Check if vehicle is already parked (reject duplicates)
2. Look up plate in `vehicles` table (is it registered?)
3. Check for active **reservation** -> use the reserved spot
4. Check for active **subscription** -> mark session as subscription type
5. Otherwise, assign first available free spot (**walk-in**)
6. Mark spot occupied, create session, send notification

The `/api/sessions/exit` endpoint:

1. Find active session for the plate
2. Free the assigned parking spot
3. Calculate fee based on facility's hourly rate (rounded up, 1-hour minimum)
4. Subscription sessions = LKR 0 (fee waived)
5. If payment_method is `wallet` and balance is sufficient, auto-deduct
6. Close session, send exit notification

## Database Schema (v2.0)

Run `supabase_schema.sql` in your Supabase SQL Editor to create 16 tables:

| Table | Description |
|-------|-------------|
| `users` | User accounts with roles (admin/user/operator) |
| `vehicles` | Registered vehicles (plate, make, model, color, type) |
| `facilities` | Parking facilities (name, address, capacity, hourly_rate) |
| `floors` | Floors within facilities |
| `parking_spots` | Individual spots (regular/handicapped/ev_charging/vip) |
| `pricing_plans` | Pricing plans (hourly/daily/monthly/reservation) |
| `reservations` | Advance bookings with QR codes and status tracking |
| `parking_sessions` | Active and historical sessions |
| `user_wallets` | Wallet balances for auto-payment |
| `payments` | Payment records (sessions, top-ups, subscriptions) |
| `subscriptions` | Monthly passes with auto-renew |
| `cameras` | Camera configs linked to facilities and gates |
| `gates` | Entry/exit gates with hardware IP |
| `detection_logs` | LPR detections with confidence and registration status |
| `gate_events` | Gate open/close audit log |
| `notifications` | User notifications |

## Backward Compatibility

All v1 endpoints are aliased to v2 equivalents:

| v1 Endpoint | v2 Equivalent |
|-------------|---------------|
| `POST /api/signup` | `/api/auth/signup` |
| `POST /api/login` | `/api/auth/login` |
| `GET /api/spots` | `/api/facilities/:first/spots` |
| `POST /api/init-spots` | Creates facility + spots |
| `POST /api/vehicle/entry` | `/api/sessions/entry` |
| `POST /api/vehicle/exit` | `/api/sessions/exit` |
| `GET /api/logs` | `/api/sessions` |
| `POST /api/reset-system` | `/api/system/reset` |
| `GET /api/detection-logs` | `/api/detections` |

## External Integrations

### SentraAI LPR Service (port 5001)

The backend communicates with SentraAI for health checks:
- `GET http://127.0.0.1:5001/api/health` (proxied via `/api/lpr/status`)
- The URL is hardcoded in `routes_common.py`

## Docker

```bash
docker build -t sentra-backend .
docker run -p 5000:5000 \
  -e SUPABASE_URL=https://xxx.supabase.co \
  -e SUPABASE_KEY=your-key \
  sentra-backend
```
