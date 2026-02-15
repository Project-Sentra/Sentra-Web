# Sentra LPR Parking System - API Documentation (v2.0)

Complete REST API reference for the Sentra LPR Parking System backend.
**Base URL:** `http://127.0.0.1:5000/api`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [User Management (Admin)](#2-user-management-admin)
3. [Vehicles](#3-vehicles)
4. [Facilities](#4-facilities)
5. [Parking Spots](#5-parking-spots)
6. [Reservations](#6-reservations)
7. [Parking Sessions (Entry/Exit)](#7-parking-sessions-entryexit)
8. [Payments & Wallet](#8-payments--wallet)
9. [Subscriptions](#9-subscriptions)
10. [Cameras](#10-cameras)
11. [Gates](#11-gates)
12. [Detection Logs](#12-detection-logs)
13. [Notifications](#13-notifications)
14. [Dashboard / Analytics](#14-dashboard--analytics)
15. [System](#15-system)
16. [Backward Compatibility](#16-backward-compatibility)

---

## Auth Headers

All protected endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Tokens are obtained from the `/api/auth/login` endpoint.

**Role-based access:**
- `@require_auth` - Any authenticated user (admin, user, operator)
- `@require_admin` - Admin or operator only

---

## 1. Authentication

### POST `/api/auth/signup`

Register a new user (admin dashboard or mobile app).

**Body:**
```json
{
  "email": "user@example.com",
  "password": "secure123",
  "full_name": "John Doe",
  "phone": "+94771234567",
  "role": "user"
}
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| email | Yes | - | Unique email address |
| password | Yes | - | Min 6 characters |
| full_name | No | "" | Display name |
| phone | No | "" | Phone number |
| role | No | "user" | `admin`, `user`, or `operator` |

**Response (201):**
```json
{
  "message": "Account created! Please check your email to verify.",
  "user_id": "uuid-string"
}
```

---

### POST `/api/auth/login`

Authenticate and receive JWT tokens.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "secure123"
}
```

**Response (200):**
```json
{
  "message": "Login successful!",
  "access_token": "eyJhbGci...",
  "refresh_token": "refresh-token...",
  "user": {
    "id": "supabase-auth-uuid",
    "db_id": 1,
    "email": "user@example.com",
    "full_name": "John Doe",
    "phone": "+94771234567",
    "role": "admin"
  }
}
```

---

### GET `/api/auth/me` (protected)

Get current user's profile including wallet balance.

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "John Doe",
    "phone": "+94771234567",
    "role": "admin",
    "is_active": true,
    "wallet_balance": 5000,
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

---

### PUT `/api/auth/me` (protected)

Update current user's profile.

**Body:**
```json
{
  "full_name": "John Updated",
  "phone": "+94779876543"
}
```

---

## 2. User Management (Admin)

### GET `/api/admin/users` (admin only)

List all users. Optional `?role=admin|user|operator` filter.

**Response (200):**
```json
{
  "users": [
    {
      "id": 1,
      "email": "admin@sentra.lk",
      "full_name": "Admin One",
      "phone": "+94771234567",
      "role": "admin",
      "is_active": true,
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### GET `/api/admin/users/:id` (admin only)

Get user details with their registered vehicles.

---

### PUT `/api/admin/users/:id` (admin only)

Update user role or active status.

**Body:**
```json
{
  "role": "operator",
  "is_active": false
}
```

---

## 3. Vehicles

### POST `/api/vehicles` (protected)

Register a new vehicle for the current user.

**Body:**
```json
{
  "plate_number": "WP CA-1234",
  "make": "Toyota",
  "model": "Corolla",
  "color": "White",
  "year": 2022,
  "vehicle_type": "car"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| plate_number | Yes | Unique license plate |
| make | No | Manufacturer |
| model | No | Model name |
| color | No | Vehicle color |
| year | No | Manufacturing year |
| vehicle_type | No | `car`, `motorcycle`, `truck`, `van` |

**Response (201):**
```json
{
  "message": "Vehicle registered",
  "vehicle": { "..." }
}
```

---

### GET `/api/vehicles` (protected)

Get vehicles. Regular users see only their own. Admin can pass `?all=true` to see all vehicles with owner info.

---

### PUT `/api/vehicles/:id` (protected)

Update vehicle details (make, model, color, year, vehicle_type, is_active).

---

### DELETE `/api/vehicles/:id` (protected)

Soft-delete (deactivate) a vehicle.

---

### GET `/api/vehicles/lookup/:plate_number` (public)

Look up a vehicle by plate number. Used by the LPR service to check if a detected plate is registered.

**Response (200):**
```json
{
  "registered": true,
  "vehicle": {
    "id": 1,
    "plate_number": "WP CA-1234",
    "make": "Toyota",
    "model": "Corolla",
    "users": {
      "id": 1,
      "email": "user@example.com",
      "full_name": "John Doe"
    }
  },
  "has_subscription": false,
  "subscription": null
}
```

---

## 4. Facilities

### GET `/api/facilities` (public)

List all active parking facilities with live occupancy counts.

**Response (200):**
```json
{
  "facilities": [
    {
      "id": 1,
      "name": "Sentra Main Parking",
      "address": "123 Colombo Road",
      "city": "Colombo",
      "total_spots": 32,
      "occupied_spots": 12,
      "reserved_spots": 3,
      "available_spots": 17,
      "hourly_rate": 150,
      "operating_hours_start": "06:00",
      "operating_hours_end": "22:00"
    }
  ]
}
```

---

### POST `/api/facilities` (admin only)

Create a new parking facility.

**Body:**
```json
{
  "name": "Sentra Main Parking",
  "address": "123 Colombo Road",
  "city": "Colombo",
  "total_spots": 32,
  "hourly_rate": 150,
  "operating_hours_start": "06:00",
  "operating_hours_end": "22:00"
}
```

---

### GET `/api/facilities/:id` (public)

Get facility details with floors and spot summary.

---

### PUT `/api/facilities/:id` (admin only)

Update facility details.

---

### DELETE `/api/facilities/:id` (admin only)

Permanently delete a facility and its related records.

---

## 5. Parking Spots

### GET `/api/facilities/:id/spots` (public)

Get all parking spots for a facility.

**Response (200):**
```json
{
  "spots": [
    {
      "id": 1,
      "facility_id": 1,
      "spot_name": "A-01",
      "spot_type": "regular",
      "is_occupied": false,
      "is_reserved": false,
      "is_active": true
    }
  ]
}
```

---

### POST `/api/facilities/:id/spots/init` (admin only)

Initialize parking spots for a facility (bulk create).

**Body:**
```json
{
  "count": 32,
  "prefix": "A",
  "spot_type": "regular"
}
```

---

### PUT `/api/spots/:id` (admin only)

Update spot type or active status.

---

## 6. Reservations

### POST `/api/reservations` (protected)

Book a parking spot in advance.

**Body:**
```json
{
  "vehicle_id": 1,
  "facility_id": 1,
  "reserved_start": "2024-12-20T09:00:00Z",
  "reserved_end": "2024-12-20T17:00:00Z",
  "spot_type": "regular"
}
```

**Response (201):**
```json
{
  "message": "Reservation confirmed",
  "reservation": {
    "id": 1,
    "spot_id": 5,
    "status": "confirmed",
    "qr_code": "uuid-for-check-in",
    "amount": 200
  }
}
```

The system automatically:
- Finds an available spot of the requested type
- Marks it as reserved
- Creates a QR code for check-in
- Sends a notification to the user

---

### GET `/api/reservations` (protected)

Get reservations. Users see their own. Admin can pass `?all=true`.
Optional filter: `?status=confirmed|pending|cancelled|completed|checked_in|no_show`

---

### PUT `/api/reservations/:id` (protected)

Update or cancel a reservation.

**Cancel:**
```json
{
  "action": "cancel"
}
```

**Update times:**
```json
{
  "reserved_start": "2024-12-20T10:00:00Z",
  "reserved_end": "2024-12-20T18:00:00Z"
}
```

---

## 7. Parking Sessions (Entry/Exit)

### POST `/api/sessions/entry` (public)

Register a vehicle entering a facility. Called by the LPR service or manually by admin.

**Body:**
```json
{
  "plate_number": "WP CA-1234",
  "facility_id": 1,
  "entry_method": "lpr"
}
```

**Entry Flow:**
1. Checks if vehicle is already parked (prevents duplicates)
2. Looks up plate in vehicles table (registered?)
3. Checks for active reservation - uses reserved spot
4. Checks for active subscription - marks session type
5. Otherwise finds first free spot (walk-in)
6. Marks spot occupied, creates session, notifies user

**Response (200):**
```json
{
  "message": "Vehicle WP CA-1234 parked at A-05",
  "spot": "A-05",
  "session_type": "reserved",
  "is_registered": true,
  "gate_action": "open",
  "session_id": 42
}
```

| gate_action | Meaning |
|-------------|---------|
| `open` | Registered vehicle - auto-open gate |
| `pending` | Unregistered - await manual approval |
| `deny` | Vehicle already parked or no spots |

---

### POST `/api/sessions/exit` (public)

Process a vehicle exiting.

**Body:**
```json
{
  "plate_number": "WP CA-1234",
  "payment_method": "wallet"
}
```

**Exit Flow:**
1. Finds active session for this plate
2. Frees the parking spot
3. Calculates fee (hourly rate x hours, rounded up)
4. Subscription sessions = LKR 0 (waived)
5. Wallet payment auto-deducted if sufficient balance
6. Closes session and sends exit notification

**Response (200):**
```json
{
  "message": "Spot A-05 is now free!",
  "duration_minutes": 127,
  "amount": 450,
  "payment_status": "paid",
  "gate_action": "open"
}
```

---

### GET `/api/sessions` (protected)

Get session history. Users see sessions for their vehicles only.
Admin can pass `?all=true`.

**Query params:**

| Param | Description |
|-------|-------------|
| facility_id | Filter by facility |
| active | `true` = only sessions without exit_time |
| all | `true` = all sessions (admin) |
| limit | Max results (default 50) |

---

## 8. Payments & Wallet

### GET `/api/wallet` (protected)

Get current user's wallet balance.

**Response (200):**
```json
{
  "id": 1,
  "user_id": 1,
  "balance": 5000,
  "currency": "LKR"
}
```

---

### POST `/api/wallet/topup` (protected)

Add funds to wallet.

**Body:**
```json
{
  "amount": 1000,
  "payment_method": "card"
}
```

---

### GET `/api/payments` (protected)

Get payment history. Admin can pass `?all=true` for all users.

---

## 9. Subscriptions

### POST `/api/subscriptions` (protected)

Purchase a monthly pass. Wallet balance must be sufficient.

**Body:**
```json
{
  "facility_id": 1,
  "vehicle_id": 1,
  "plan_id": 3
}
```

---

### GET `/api/subscriptions` (protected)

Get subscriptions. Admin with `?all=true` sees all.

---

### PUT `/api/subscriptions/:id` (protected)

Cancel or toggle auto-renew.

```json
{ "action": "cancel" }
```
or
```json
{ "auto_renew": true }
```

---

## 10. Cameras

### GET `/api/cameras` (admin only)

List cameras. Optional `?facility_id=1`.

---

### POST `/api/cameras` (admin only)

Add a camera.

**Body:**
```json
{
  "facility_id": 1,
  "camera_id": "CAM-ENTRY-01",
  "name": "Main Entry Camera",
  "camera_type": "entry",
  "source_url": "rtsp://192.168.1.100/stream",
  "gate_id": 1
}
```

---

### DELETE `/api/cameras/:id` (admin only)

Remove a camera.

---

## 11. Gates

### GET `/api/gates` (admin only)

List gates. Optional `?facility_id=1`.

---

### POST `/api/gates` (admin only)

Add a gate.

**Body:**
```json
{
  "facility_id": 1,
  "name": "Main Entry Gate",
  "gate_type": "entry",
  "hardware_ip": "192.168.1.200"
}
```

---

### POST `/api/gates/:id/open` (admin only)

Manually open a gate. Logs a gate event.

---

### POST `/api/gates/:id/close` (admin only)

Manually close a gate. Logs a gate event.

---

## 12. Detection Logs

### GET `/api/detections` (admin only)

Get LPR detection event logs. Optional `?facility_id=1&limit=50`.

---

### POST `/api/detections` (public)

Log a detection from the LPR service.

**Body:**
```json
{
  "camera_id": "CAM-ENTRY-01",
  "facility_id": 1,
  "plate_number": "WP CA-1234",
  "confidence": 0.95,
  "vehicle_class": "car",
  "image_url": "https://storage.example.com/snapshot.jpg"
}
```

Auto-checks if the plate is registered and flags the detection.

---

### PATCH `/api/detections/:id/action` (admin only)

Approve/reject a detection.

**Body:**
```json
{
  "action": "entry"
}
```

Valid actions: `entry`, `exit`, `ignored`, `gate_opened`

---

## 13. Notifications

### GET `/api/notifications` (protected)

Get current user's notifications. Optional `?limit=50`.

---

### PUT `/api/notifications/:id/read` (protected)

Mark one notification as read.

---

### PUT `/api/notifications/read-all` (protected)

Mark all notifications as read.

---

## 14. Dashboard / Analytics

### GET `/api/dashboard/stats?facility_id=1` (admin only)

Get dashboard statistics for a facility.

**Response (200):**
```json
{
  "spots": {
    "total": 32,
    "occupied": 12,
    "reserved": 3,
    "available": 17
  },
  "today": {
    "entries": 45,
    "revenue": 87000,
    "active_sessions": 12,
    "reservations": 5
  },
  "system": {
    "total_users": 150,
    "total_vehicles": 89
  }
}
```

---

### GET `/api/dashboard/recent-activity` (admin only)

Get recent sessions and detections. Optional `?facility_id=1&limit=20`.

---

## 15. System

### POST `/api/system/reset` (admin only)

Reset the system - clear all sessions, reservations, and free all spots.
**DESTRUCTIVE operation.** Optional `facility_id` in body to reset only one facility.

---

### GET `/api/lpr/status` (admin only)

Health check for the SentraAI LPR service (port 5001).

**Response (200):**
```json
{
  "connected": true,
  "cameras_active": 2,
  "model_loaded": true
}
```

---

## 16. Backward Compatibility

The following v1 endpoints are aliased to their v2 equivalents so the existing frontend continues to work during migration:

| v1 Endpoint | Maps To |
|-------------|---------|
| `POST /api/signup` | `/api/auth/signup` |
| `POST /api/login` | `/api/auth/login` |
| `GET /api/spots` | `/api/facilities/:first/spots` |
| `POST /api/init-spots` | Creates facility + spots |
| `POST /api/vehicle/entry` | `/api/sessions/entry` |
| `POST /api/vehicle/exit` | `/api/sessions/exit` |
| `GET /api/logs` | `/api/sessions` (formatted) |
| `POST /api/reset-system` | `/api/system/reset` |
| `GET /api/detection-logs` | `/api/detections` |
| `POST /api/detection-logs` | `/api/detections` |
| `PATCH /api/detection-logs/:id/action` | `/api/detections/:id/action` |

---

## Legend

| Label | Meaning |
|-------|---------|
| (protected) | Requires JWT authentication (`@require_auth`) |
| (admin only) | Admin/operator only (`@require_admin`) |
| (public) | No authentication required |

---

## Error Responses

All errors follow this format:

```json
{
  "message": "Description of what went wrong"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request / missing required fields |
| 401 | Authentication required or token expired |
| 403 | Insufficient permissions (not admin) |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate plate, vehicle already parked) |
| 500 | Server error |

---

## Integration Notes

### LPR Service Integration

The admin backend integrates with SentraAI LPR service running on `http://127.0.0.1:5001`.

**Service Health Check:**
```http
GET http://127.0.0.1:5001/api/health
```

### WebSocket Events (via SentraAI)

The React frontend connects directly to the SentraAI service (`ws://127.0.0.1:5001/api/ws`) for real-time events.
The Flask backend does NOT serve WebSocket connections.

WebSocket message types from SentraAI:
- `plate_detected` - A license plate was recognized by a camera
- `camera_status` - Camera online/offline status change
- `processing_update` - Frame processing progress
- `pong` - Heartbeat response

See `admin_frontend/src/hooks/useWebSocket.js` for the client implementation.

---

## Testing Examples

### Using cURL

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

**Get Facilities:**
```bash
curl -X GET http://localhost:5000/api/facilities
```

**Vehicle Entry:**
```bash
curl -X POST http://localhost:5000/api/sessions/entry \
  -H "Content-Type: application/json" \
  -d '{"plate_number":"WP CA-1234","facility_id":1}'
```

**Vehicle Exit:**
```bash
curl -X POST http://localhost:5000/api/sessions/exit \
  -H "Content-Type: application/json" \
  -d '{"plate_number":"WP CA-1234"}'
```

---

## Environment Variables

Required environment variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-public-key
```

The SentraAI LPR service URL (`http://127.0.0.1:5001`) is currently hardcoded in `routes.py`.

---

**Document Version:** 2.0
**Last Updated:** July 2025
**Maintained By:** Project Sentra Team
