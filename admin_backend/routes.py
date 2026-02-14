"""
routes.py - API Route Handlers (v2.0)
======================================
Complete REST API for the Sentra LPR Parking System.
Serves BOTH the admin web dashboard and the mobile app from a single backend.

Endpoint Groups:
  1. Auth          – Sign up, log in, profile (admin + mobile users)
  2. Users         – Admin: list / manage all users
  3. Vehicles      – Register vehicles, lookup by plate (shared)
  4. Facilities    – CRUD for parking locations (admin)
  5. Parking Spots – List / init spots per facility
  6. Reservations  – Advance booking (mobile users + admin view)
  7. Sessions      – Vehicle entry / exit (LPR + manual)
  8. Payments      – Payment records and wallet
  9. Subscriptions – Monthly passes
 10. Cameras       – Camera hardware config (admin)
 11. Gates         – Gate hardware + open/close (admin + LPR)
 12. Detections    – LPR detection event logs
 13. Notifications – User notifications (mobile)
 14. Dashboard     – Admin analytics / stats
 15. System        – Reset, health check

Authentication:
  - @require_auth  – Any authenticated user
  - @require_admin – Admin-only endpoints
  - Public endpoints have no decorator (LPR service, entry/exit)
"""

from flask import request, jsonify
from datetime import datetime, timezone, timedelta
from math import ceil
import httpx
import uuid
from functools import wraps
from app import app, supabase


# ==========================================================================
# CONSTANTS
# ==========================================================================

LPR_SERVICE_URL = "http://127.0.0.1:5001"

DEFAULT_HOURLY_RATE = 150      # LKR per hour (fallback when facility has no rate)
DEFAULT_CURRENCY = "LKR"


# ==========================================================================
# AUTH MIDDLEWARE
# ==========================================================================

def require_auth(f):
    """Protect a route: any valid JWT is accepted."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"message": "No authorization token provided"}), 401
        try:
            token = auth_header.split(" ")[1] if " " in auth_header else auth_header
            user = supabase.auth.get_user(token)
            if not user:
                return jsonify({"message": "Invalid or expired token"}), 401
            request.current_user = user.user
            # Attach local DB user record
            db_user = (
                supabase.table("users")
                .select("*")
                .eq("auth_user_id", user.user.id)
                .limit(1)
                .execute()
            )
            request.db_user = db_user.data[0] if db_user.data else None
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({"message": f"Authentication failed: {str(e)}"}), 401
    return decorated


def require_admin(f):
    """Protect a route: only admin users."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"message": "No authorization token provided"}), 401
        try:
            token = auth_header.split(" ")[1] if " " in auth_header else auth_header
            user = supabase.auth.get_user(token)
            if not user:
                return jsonify({"message": "Invalid or expired token"}), 401
            request.current_user = user.user
            db_user = (
                supabase.table("users")
                .select("*")
                .eq("auth_user_id", user.user.id)
                .limit(1)
                .execute()
            )
            if not db_user.data or db_user.data[0]["role"] not in ("admin", "operator"):
                return jsonify({"message": "Admin access required"}), 403
            request.db_user = db_user.data[0]
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({"message": f"Authentication failed: {str(e)}"}), 401
    return decorated


# ==========================================================================
# 1. AUTH ENDPOINTS
# ==========================================================================

@app.route("/api/auth/signup", methods=["POST"])
def signup():
    """
    POST /api/auth/signup
    Register a new user (admin or mobile app user).

    Body: { "email", "password", "full_name"?, "phone"?, "role"?: "user"|"admin" }
    """
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    full_name = data.get("full_name", "")
    phone = data.get("phone", "")
    role = data.get("role", "user")  # Default = mobile app user

    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400
    if len(password) < 6:
        return jsonify({"message": "Password must be at least 6 characters"}), 400
    if role not in ("admin", "user", "operator"):
        return jsonify({"message": "role must be admin, user, or operator"}), 400

    try:
        response = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {"data": {"role": role, "full_name": full_name}},
        })

        if response.user:
            # Create local user record
            user_record = {
                "email": email,
                "full_name": full_name,
                "phone": phone,
                "role": role,
                "auth_user_id": response.user.id,
            }
            result = supabase.table("users").insert(user_record).execute()

            # Create wallet for the user
            if result.data:
                supabase.table("user_wallets").insert({
                    "user_id": result.data[0]["id"],
                    "balance": 0,
                }).execute()

            return jsonify({
                "message": "Account created! Please check your email to verify.",
                "user_id": response.user.id,
            }), 201
        else:
            return jsonify({"message": "Failed to create account"}), 400

    except Exception as e:
        error_msg = str(e)
        if "already registered" in error_msg.lower():
            return jsonify({"message": "An account with this email already exists"}), 400
        return jsonify({"message": f"Error: {error_msg}"}), 500


@app.route("/api/auth/login", methods=["POST"])
def login():
    """
    POST /api/auth/login
    Authenticate and return JWT tokens + user info.

    Body: { "email", "password" }
    """
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400

    try:
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password,
        })

        if response.user and response.session:
            user_data = (
                supabase.table("users")
                .select("*")
                .eq("email", email)
                .limit(1)
                .execute()
            )
            user_record = user_data.data[0] if user_data.data else {}

            return jsonify({
                "message": "Login successful!",
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "user": {
                    "id": response.user.id,
                    "db_id": user_record.get("id"),
                    "email": response.user.email,
                    "full_name": user_record.get("full_name", ""),
                    "phone": user_record.get("phone", ""),
                    "role": user_record.get("role", "user"),
                },
            }), 200
        else:
            return jsonify({"message": "Invalid email or password"}), 401

    except Exception as e:
        return jsonify({"message": f"Login failed: {str(e)}"}), 401


@app.route("/api/auth/me", methods=["GET"])
@require_auth
def get_profile():
    """GET /api/auth/me – Get current user's profile."""
    if not request.db_user:
        return jsonify({"message": "User profile not found"}), 404

    user = request.db_user
    # Get wallet balance
    wallet = (
        supabase.table("user_wallets")
        .select("balance")
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )

    return jsonify({
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user.get("full_name"),
            "phone": user.get("phone"),
            "role": user["role"],
            "is_active": user["is_active"],
            "wallet_balance": wallet.data[0]["balance"] if wallet.data else 0,
            "created_at": user["created_at"],
        }
    }), 200


@app.route("/api/auth/me", methods=["PUT"])
@require_auth
def update_profile():
    """PUT /api/auth/me – Update current user's profile."""
    data = request.get_json()
    updates = {}
    for field in ["full_name", "phone", "profile_image"]:
        if field in data:
            updates[field] = data[field]

    if not updates:
        return jsonify({"message": "No fields to update"}), 400

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    supabase.table("users").update(updates).eq(
        "id", request.db_user["id"]
    ).execute()

    return jsonify({"message": "Profile updated"}), 200


# ==========================================================================
# 2. USER MANAGEMENT (Admin)
# ==========================================================================

@app.route("/api/admin/users", methods=["GET"])
@require_admin
def list_users():
    """GET /api/admin/users – List all users with optional role filter."""
    role_filter = request.args.get("role")
    query = supabase.table("users").select("*").order("created_at", desc=True)
    if role_filter:
        query = query.eq("role", role_filter)
    result = query.execute()
    return jsonify({"users": result.data}), 200


@app.route("/api/admin/users/<int:user_id>", methods=["GET"])
@require_admin
def get_user(user_id):
    """GET /api/admin/users/:id – Get user details with their vehicles."""
    user = supabase.table("users").select("*").eq("id", user_id).limit(1).execute()
    if not user.data:
        return jsonify({"message": "User not found"}), 404

    vehicles = (
        supabase.table("vehicles")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    return jsonify({"user": user.data[0], "vehicles": vehicles.data}), 200


@app.route("/api/admin/users/<int:user_id>", methods=["PUT"])
@require_admin
def update_user(user_id):
    """PUT /api/admin/users/:id – Update user role / active status."""
    data = request.get_json()
    updates = {}
    if "role" in data and data["role"] in ("admin", "user", "operator"):
        updates["role"] = data["role"]
    if "is_active" in data:
        updates["is_active"] = bool(data["is_active"])

    if not updates:
        return jsonify({"message": "No valid fields to update"}), 400

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    supabase.table("users").update(updates).eq("id", user_id).execute()
    return jsonify({"message": "User updated"}), 200


# ==========================================================================
# 3. VEHICLE MANAGEMENT
# ==========================================================================

@app.route("/api/vehicles", methods=["POST"])
@require_auth
def register_vehicle():
    """
    POST /api/vehicles
    Register a new vehicle for the current user.

    Body: { "plate_number", "make"?, "model"?, "color"?, "year"?, "vehicle_type"? }
    """
    data = request.get_json()
    plate = data.get("plate_number")
    if not plate:
        return jsonify({"message": "plate_number is required"}), 400

    # Check if plate already registered
    existing = (
        supabase.table("vehicles")
        .select("id")
        .eq("plate_number", plate)
        .limit(1)
        .execute()
    )
    if existing.data:
        return jsonify({"message": f"Vehicle {plate} is already registered"}), 409

    vehicle = {
        "user_id": request.db_user["id"],
        "plate_number": plate,
        "make": data.get("make", ""),
        "model": data.get("model", ""),
        "color": data.get("color", ""),
        "year": data.get("year"),
        "vehicle_type": data.get("vehicle_type", "car"),
    }
    result = supabase.table("vehicles").insert(vehicle).execute()
    return jsonify({"message": "Vehicle registered", "vehicle": result.data[0]}), 201


@app.route("/api/vehicles", methods=["GET"])
@require_auth
def get_vehicles():
    """
    GET /api/vehicles
    - Regular users: returns only their vehicles
    - Admin: returns all vehicles (with ?all=true) or their own
    """
    if request.args.get("all") == "true" and request.db_user["role"] in ("admin", "operator"):
        result = supabase.table("vehicles").select("*, users(email, full_name)").order("created_at", desc=True).execute()
    else:
        result = (
            supabase.table("vehicles")
            .select("*")
            .eq("user_id", request.db_user["id"])
            .order("created_at", desc=True)
            .execute()
        )
    return jsonify({"vehicles": result.data}), 200


@app.route("/api/vehicles/<int:vehicle_id>", methods=["PUT"])
@require_auth
def update_vehicle(vehicle_id):
    """PUT /api/vehicles/:id – Update vehicle details."""
    data = request.get_json()
    updates = {}
    for field in ["make", "model", "color", "year", "vehicle_type", "is_active"]:
        if field in data:
            updates[field] = data[field]

    if not updates:
        return jsonify({"message": "No fields to update"}), 400

    supabase.table("vehicles").update(updates).eq("id", vehicle_id).execute()
    return jsonify({"message": "Vehicle updated"}), 200


@app.route("/api/vehicles/<int:vehicle_id>", methods=["DELETE"])
@require_auth
def deactivate_vehicle(vehicle_id):
    """DELETE /api/vehicles/:id – Deactivate (soft-delete) a vehicle."""
    supabase.table("vehicles").update({"is_active": False}).eq("id", vehicle_id).execute()
    return jsonify({"message": "Vehicle deactivated"}), 200


@app.route("/api/vehicles/lookup/<plate_number>", methods=["GET"])
def lookup_vehicle(plate_number):
    """
    GET /api/vehicles/lookup/:plate
    Look up a vehicle by plate number. Used by LPR service to check
    if a detected plate belongs to a registered user.

    Public endpoint (no auth) so the AI service can call it.
    """
    result = (
        supabase.table("vehicles")
        .select("*, users(id, email, full_name, phone)")
        .eq("plate_number", plate_number)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )

    if not result.data:
        return jsonify({"registered": False, "plate_number": plate_number}), 200

    vehicle = result.data[0]
    # Check for active subscription
    sub = (
        supabase.table("subscriptions")
        .select("*")
        .eq("vehicle_id", vehicle["id"])
        .eq("status", "active")
        .limit(1)
        .execute()
    )

    return jsonify({
        "registered": True,
        "vehicle": vehicle,
        "has_subscription": len(sub.data) > 0,
        "subscription": sub.data[0] if sub.data else None,
    }), 200


# ==========================================================================
# 4. FACILITY MANAGEMENT
# ==========================================================================

@app.route("/api/facilities", methods=["GET"])
def get_facilities():
    """GET /api/facilities – List all active facilities (public for mobile app)."""
    result = (
        supabase.table("facilities")
        .select("*")
        .eq("is_active", True)
        .order("name")
        .execute()
    )

    # Add live occupancy counts
    facilities = []
    for f in result.data:
        spots = (
            supabase.table("parking_spots")
            .select("is_occupied, is_reserved")
            .eq("facility_id", f["id"])
            .eq("is_active", True)
            .execute()
        )
        total = len(spots.data)
        occupied = sum(1 for s in spots.data if s["is_occupied"])
        reserved = sum(1 for s in spots.data if s["is_reserved"] and not s["is_occupied"])

        f["total_spots"] = total
        f["occupied_spots"] = occupied
        f["reserved_spots"] = reserved
        f["available_spots"] = total - occupied - reserved
        facilities.append(f)

    return jsonify({"facilities": facilities}), 200


@app.route("/api/facilities", methods=["POST"])
@require_admin
def create_facility():
    """POST /api/facilities – Create a new parking facility."""
    data = request.get_json()
    if not data.get("name"):
        return jsonify({"message": "Facility name is required"}), 400

    facility = {
        "name": data["name"],
        "address": data.get("address", ""),
        "city": data.get("city", ""),
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "total_spots": data.get("total_spots", 0),
        "hourly_rate": data.get("hourly_rate", DEFAULT_HOURLY_RATE),
        "operating_hours_start": data.get("operating_hours_start", "06:00"),
        "operating_hours_end": data.get("operating_hours_end", "22:00"),
        "image_url": data.get("image_url"),
    }
    result = supabase.table("facilities").insert(facility).execute()
    return jsonify({"message": "Facility created", "facility": result.data[0]}), 201


@app.route("/api/facilities/<int:facility_id>", methods=["GET"])
def get_facility(facility_id):
    """GET /api/facilities/:id – Get facility details with floors and spot summary."""
    facility = supabase.table("facilities").select("*").eq("id", facility_id).limit(1).execute()
    if not facility.data:
        return jsonify({"message": "Facility not found"}), 404

    floors = (
        supabase.table("floors")
        .select("*")
        .eq("facility_id", facility_id)
        .order("floor_number")
        .execute()
    )

    spots = (
        supabase.table("parking_spots")
        .select("is_occupied, is_reserved, spot_type")
        .eq("facility_id", facility_id)
        .eq("is_active", True)
        .execute()
    )
    total = len(spots.data)
    occupied = sum(1 for s in spots.data if s["is_occupied"])
    reserved = sum(1 for s in spots.data if s["is_reserved"] and not s["is_occupied"])

    return jsonify({
        "facility": facility.data[0],
        "floors": floors.data,
        "summary": {
            "total": total,
            "occupied": occupied,
            "reserved": reserved,
            "available": total - occupied - reserved,
        },
    }), 200


@app.route("/api/facilities/<int:facility_id>", methods=["PUT"])
@require_admin
def update_facility(facility_id):
    """PUT /api/facilities/:id – Update facility details."""
    data = request.get_json()
    updates = {}
    for field in ["name", "address", "city", "latitude", "longitude", "hourly_rate",
                  "operating_hours_start", "operating_hours_end", "is_active", "image_url"]:
        if field in data:
            updates[field] = data[field]
    if not updates:
        return jsonify({"message": "No fields to update"}), 400

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    supabase.table("facilities").update(updates).eq("id", facility_id).execute()
    return jsonify({"message": "Facility updated"}), 200


@app.route("/api/facilities/<int:facility_id>", methods=["DELETE"])
@require_admin
def delete_facility(facility_id):
    """DELETE /api/facilities/:id – Remove a facility."""
    supabase.table("facilities").delete().eq("id", facility_id).execute()
    return jsonify({"message": "Facility deleted"}), 200


# ==========================================================================
# 5. PARKING SPOTS
# ==========================================================================

@app.route("/api/facilities/<int:facility_id>/spots", methods=["GET"])
def get_spots(facility_id):
    """GET /api/facilities/:id/spots – Get all spots for a facility."""
    result = (
        supabase.table("parking_spots")
        .select("*")
        .eq("facility_id", facility_id)
        .order("id")
        .execute()
    )
    return jsonify({"spots": result.data}), 200


@app.route("/api/facilities/<int:facility_id>/spots/init", methods=["POST"])
@require_admin
def init_spots(facility_id):
    """
    POST /api/facilities/:id/spots/init
    Initialize parking spots for a facility.

    Body: { "count": 32, "prefix": "A", "floor_id"?: 1, "spot_type"?: "regular" }
    """
    data = request.get_json() or {}
    count = data.get("count", 32)
    prefix = data.get("prefix", "A")
    floor_id = data.get("floor_id")
    spot_type = data.get("spot_type", "regular")

    # Check if spots already exist
    existing = (
        supabase.table("parking_spots")
        .select("id")
        .eq("facility_id", facility_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        return jsonify({"message": "Spots already initialized for this facility"}), 400

    spots = []
    for i in range(1, count + 1):
        spots.append({
            "facility_id": facility_id,
            "floor_id": floor_id,
            "spot_name": f"{prefix}-{str(i).zfill(2)}",
            "spot_type": spot_type,
            "is_occupied": False,
            "is_reserved": False,
        })

    supabase.table("parking_spots").insert(spots).execute()

    # Update facility total
    supabase.table("facilities").update({"total_spots": count}).eq("id", facility_id).execute()

    return jsonify({"message": f"{count} spots created"}), 201


@app.route("/api/spots/<int:spot_id>", methods=["PUT"])
@require_admin
def update_spot(spot_id):
    """PUT /api/spots/:id – Update spot type or active status."""
    data = request.get_json()
    updates = {}
    for field in ["spot_type", "is_active"]:
        if field in data:
            updates[field] = data[field]
    if updates:
        supabase.table("parking_spots").update(updates).eq("id", spot_id).execute()
    return jsonify({"message": "Spot updated"}), 200


# ==========================================================================
# 6. RESERVATIONS
# ==========================================================================

@app.route("/api/reservations", methods=["POST"])
@require_auth
def create_reservation():
    """
    POST /api/reservations
    Book a parking spot in advance.

    Body: { "vehicle_id", "facility_id", "reserved_start", "reserved_end", "spot_type"?: "regular" }
    """
    data = request.get_json()
    vehicle_id = data.get("vehicle_id")
    facility_id = data.get("facility_id")
    start = data.get("reserved_start")
    end = data.get("reserved_end")
    spot_type = data.get("spot_type", "regular")

    if not all([vehicle_id, facility_id, start, end]):
        return jsonify({"message": "vehicle_id, facility_id, reserved_start, and reserved_end are required"}), 400

    # Find an available spot of the requested type
    spots = (
        supabase.table("parking_spots")
        .select("*")
        .eq("facility_id", facility_id)
        .eq("is_occupied", False)
        .eq("is_reserved", False)
        .eq("is_active", True)
        .eq("spot_type", spot_type)
        .order("id")
        .limit(1)
        .execute()
    )

    if not spots.data:
        return jsonify({"message": "No available spots of this type"}), 404

    spot = spots.data[0]

    # Get reservation pricing
    pricing = (
        supabase.table("pricing_plans")
        .select("rate")
        .eq("facility_id", facility_id)
        .eq("plan_type", "reservation")
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    amount = pricing.data[0]["rate"] if pricing.data else 200  # Default LKR 200

    # Mark spot as reserved
    supabase.table("parking_spots").update({"is_reserved": True}).eq("id", spot["id"]).execute()

    # Create reservation
    reservation = {
        "user_id": request.db_user["id"],
        "vehicle_id": vehicle_id,
        "facility_id": facility_id,
        "spot_id": spot["id"],
        "reserved_start": start,
        "reserved_end": end,
        "status": "confirmed",
        "amount": amount,
        "payment_status": "pending",
        "qr_code": str(uuid.uuid4()),
    }
    result = supabase.table("reservations").insert(reservation).execute()

    # Notify user
    _create_notification(
        request.db_user["id"],
        "Reservation Confirmed",
        f"Your spot {spot['spot_name']} is reserved. Show QR code at entry.",
        "reservation",
        {"reservation_id": result.data[0]["id"], "spot_name": spot["spot_name"]},
    )

    return jsonify({"message": "Reservation confirmed", "reservation": result.data[0]}), 201


@app.route("/api/reservations", methods=["GET"])
@require_auth
def get_reservations():
    """
    GET /api/reservations
    - Users: their reservations
    - Admin: all reservations (with ?all=true)
    """
    if request.args.get("all") == "true" and request.db_user["role"] in ("admin", "operator"):
        query = (
            supabase.table("reservations")
            .select("*, users(email, full_name), vehicles(plate_number), facilities(name), parking_spots(spot_name)")
            .order("reserved_start", desc=True)
        )
    else:
        query = (
            supabase.table("reservations")
            .select("*, vehicles(plate_number), facilities(name), parking_spots(spot_name)")
            .eq("user_id", request.db_user["id"])
            .order("reserved_start", desc=True)
        )

    status_filter = request.args.get("status")
    if status_filter:
        query = query.eq("status", status_filter)

    result = query.limit(100).execute()
    return jsonify({"reservations": result.data}), 200


@app.route("/api/reservations/<int:reservation_id>", methods=["PUT"])
@require_auth
def update_reservation(reservation_id):
    """PUT /api/reservations/:id – Update or cancel a reservation."""
    data = request.get_json()
    action = data.get("action")

    if action == "cancel":
        # Free the reserved spot
        res = supabase.table("reservations").select("spot_id, user_id").eq("id", reservation_id).limit(1).execute()
        if res.data:
            if res.data[0]["spot_id"]:
                supabase.table("parking_spots").update({"is_reserved": False}).eq("id", res.data[0]["spot_id"]).execute()

            supabase.table("reservations").update({
                "status": "cancelled",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", reservation_id).execute()

            _create_notification(
                res.data[0]["user_id"],
                "Reservation Cancelled",
                "Your parking reservation has been cancelled.",
                "reservation",
                {"reservation_id": reservation_id},
            )

        return jsonify({"message": "Reservation cancelled"}), 200

    # General update (time changes, etc.)
    updates = {}
    for field in ["reserved_start", "reserved_end", "notes"]:
        if field in data:
            updates[field] = data[field]
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        supabase.table("reservations").update(updates).eq("id", reservation_id).execute()

    return jsonify({"message": "Reservation updated"}), 200


# ==========================================================================
# 7. PARKING SESSIONS (Entry / Exit)
# ==========================================================================

@app.route("/api/sessions/entry", methods=["POST"])
def vehicle_entry():
    """
    POST /api/sessions/entry
    Register a vehicle entering a facility.

    Body: { "plate_number", "facility_id", "entry_method"?: "lpr"|"manual"|"qr_code" }

    Flow:
      1. Look up plate in vehicles table → determine if registered
      2. Check for active reservation → if found, use reserved spot
      3. Check for active subscription → if found, skip payment
      4. Otherwise, find first free spot (walk-in)
      5. Mark spot occupied, create session, notify user if registered
      6. Return gate_action: "open" if registered, "pending" if not

    This endpoint is PUBLIC so the LPR service can call it.
    """
    data = request.get_json()
    plate = data.get("plate_number")
    facility_id = data.get("facility_id")
    entry_method = data.get("entry_method", "lpr")

    if not plate:
        return jsonify({"message": "plate_number is required"}), 400
    if not facility_id:
        return jsonify({"message": "facility_id is required"}), 400

    # Check for duplicate active session
    active = (
        supabase.table("parking_sessions")
        .select("*")
        .eq("plate_number", plate)
        .is_("exit_time", "null")
        .limit(1)
        .execute()
    )
    if active.data:
        return jsonify({
            "message": f"Vehicle {plate} is already parked at {active.data[0]['spot_name']}",
            "gate_action": "deny",
        }), 409

    # Look up vehicle registration
    vehicle = (
        supabase.table("vehicles")
        .select("*, users(id, full_name)")
        .eq("plate_number", plate)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    vehicle_data = vehicle.data[0] if vehicle.data else None
    vehicle_id = vehicle_data["id"] if vehicle_data else None
    user_id = vehicle_data["user_id"] if vehicle_data else None
    is_registered = vehicle_data is not None

    session_type = "walk_in"
    reservation_id = None
    spot = None

    # Check for active reservation
    if vehicle_id:
        res = (
            supabase.table("reservations")
            .select("*, parking_spots(id, spot_name)")
            .eq("vehicle_id", vehicle_id)
            .eq("facility_id", facility_id)
            .eq("status", "confirmed")
            .limit(1)
            .execute()
        )
        if res.data:
            reservation = res.data[0]
            reservation_id = reservation["id"]
            session_type = "reserved"
            # Use the reserved spot
            if reservation.get("spot_id"):
                spot_result = (
                    supabase.table("parking_spots")
                    .select("*")
                    .eq("id", reservation["spot_id"])
                    .limit(1)
                    .execute()
                )
                spot = spot_result.data[0] if spot_result.data else None

            # Update reservation status
            supabase.table("reservations").update({
                "status": "checked_in",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", reservation_id).execute()

    # Check for active subscription
    if vehicle_id and session_type == "walk_in":
        sub = (
            supabase.table("subscriptions")
            .select("*")
            .eq("vehicle_id", vehicle_id)
            .eq("facility_id", facility_id)
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        if sub.data:
            session_type = "subscription"

    # Find a free spot if no reservation spot
    if not spot:
        spot_result = (
            supabase.table("parking_spots")
            .select("*")
            .eq("facility_id", facility_id)
            .eq("is_occupied", False)
            .eq("is_reserved", False)
            .eq("is_active", True)
            .order("id")
            .limit(1)
            .execute()
        )
        if not spot_result.data:
            return jsonify({"message": "Parking is full!", "gate_action": "deny"}), 404
        spot = spot_result.data[0]

    # Mark spot as occupied, clear reserved flag
    supabase.table("parking_spots").update({
        "is_occupied": True,
        "is_reserved": False,
    }).eq("id", spot["id"]).execute()

    # Create parking session
    session = {
        "vehicle_id": vehicle_id,
        "facility_id": facility_id,
        "spot_id": spot["id"],
        "reservation_id": reservation_id,
        "plate_number": plate,
        "spot_name": spot["spot_name"],
        "entry_time": datetime.now(timezone.utc).isoformat(),
        "session_type": session_type,
        "entry_method": entry_method,
    }
    session_result = supabase.table("parking_sessions").insert(session).execute()

    # Notify registered user
    if user_id:
        _create_notification(
            user_id,
            "Vehicle Entered",
            f"Your vehicle {plate} has been parked at {spot['spot_name']}.",
            "entry",
            {"session_id": session_result.data[0]["id"], "spot_name": spot["spot_name"]},
        )

    # Determine gate action
    gate_action = "open" if is_registered else "pending"

    return jsonify({
        "message": f"Vehicle {plate} parked at {spot['spot_name']}",
        "spot": spot["spot_name"],
        "session_type": session_type,
        "is_registered": is_registered,
        "gate_action": gate_action,
        "session_id": session_result.data[0]["id"],
    }), 200


@app.route("/api/sessions/exit", methods=["POST"])
def vehicle_exit():
    """
    POST /api/sessions/exit
    Process a vehicle exiting a facility.

    Body: { "plate_number", "payment_method"?: "wallet"|"cash"|"card" }

    Flow:
      1. Find active session for this plate
      2. Free the parking spot
      3. Calculate fee (skip if subscription)
      4. Process payment (wallet auto-deduct, or mark as pending)
      5. Close session, notify user
    """
    data = request.get_json() or {}
    plate = data.get("plate_number")
    payment_method = data.get("payment_method", "wallet")

    if not plate:
        return jsonify({"message": "plate_number is required"}), 400

    # Find active session
    session_result = (
        supabase.table("parking_sessions")
        .select("*")
        .eq("plate_number", plate)
        .is_("exit_time", "null")
        .order("entry_time", desc=True)
        .limit(1)
        .execute()
    )
    if not session_result.data:
        return jsonify({"message": f"No active session for {plate}"}), 404

    session = session_result.data[0]

    # Free the spot
    if session.get("spot_id"):
        supabase.table("parking_spots").update({
            "is_occupied": False,
            "is_reserved": False,
        }).eq("id", session["spot_id"]).execute()

    # Calculate duration and fee
    entry_time = datetime.fromisoformat(session["entry_time"].replace("Z", "+00:00"))
    exit_time = datetime.now(timezone.utc)
    duration_minutes = int((exit_time - entry_time).total_seconds() // 60)

    # Get facility rate
    facility = (
        supabase.table("facilities")
        .select("hourly_rate")
        .eq("id", session["facility_id"])
        .limit(1)
        .execute()
    )
    rate = facility.data[0]["hourly_rate"] if facility.data else DEFAULT_HOURLY_RATE

    # Calculate amount
    if session["session_type"] == "subscription":
        amount = 0
        payment_status = "waived"
    else:
        billed_hours = max(1, ceil(duration_minutes / 60))
        amount = billed_hours * rate
        payment_status = "pending"

    # Update session
    supabase.table("parking_sessions").update({
        "exit_time": exit_time.isoformat(),
        "duration_minutes": duration_minutes,
        "amount": amount,
        "payment_status": payment_status if amount == 0 else "pending",
    }).eq("id", session["id"]).execute()

    # Complete reservation if applicable
    if session.get("reservation_id"):
        supabase.table("reservations").update({
            "status": "completed",
            "updated_at": exit_time.isoformat(),
        }).eq("id", session["reservation_id"]).execute()

    # Auto-pay from wallet if registered user
    if amount > 0 and session.get("vehicle_id"):
        vehicle = (
            supabase.table("vehicles")
            .select("user_id")
            .eq("id", session["vehicle_id"])
            .limit(1)
            .execute()
        )
        if vehicle.data:
            user_id = vehicle.data[0]["user_id"]
            wallet = (
                supabase.table("user_wallets")
                .select("*")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if wallet.data and wallet.data[0]["balance"] >= amount and payment_method == "wallet":
                new_balance = wallet.data[0]["balance"] - amount
                supabase.table("user_wallets").update({
                    "balance": new_balance,
                    "updated_at": exit_time.isoformat(),
                }).eq("id", wallet.data[0]["id"]).execute()

                supabase.table("payments").insert({
                    "user_id": user_id,
                    "session_id": session["id"],
                    "amount": amount,
                    "payment_method": "wallet",
                    "payment_status": "completed",
                    "description": f"Parking fee for {plate} at {session['spot_name']}",
                }).execute()

                supabase.table("parking_sessions").update({
                    "payment_status": "paid",
                }).eq("id", session["id"]).execute()

                payment_status = "paid"

            # Notify user
            _create_notification(
                user_id,
                "Vehicle Exited",
                f"Your vehicle {plate} has left. Duration: {duration_minutes} min. Fee: LKR {amount}.",
                "exit",
                {"session_id": session["id"], "amount": amount, "duration_minutes": duration_minutes},
            )

    return jsonify({
        "message": f"Spot {session['spot_name']} is now free!",
        "duration_minutes": duration_minutes,
        "amount": amount,
        "payment_status": payment_status,
        "gate_action": "open",
    }), 200


@app.route("/api/sessions", methods=["GET"])
@require_auth
def get_sessions():
    """
    GET /api/sessions
    Get parking session history.

    Query params: ?facility_id=1&active=true&limit=50
    - Users: their sessions only
    - Admin: all sessions (with ?all=true)
    """
    limit = request.args.get("limit", 50, type=int)
    facility_id = request.args.get("facility_id", type=int)
    active_only = request.args.get("active") == "true"

    if request.args.get("all") == "true" and request.db_user["role"] in ("admin", "operator"):
        query = supabase.table("parking_sessions").select("*")
    elif request.db_user.get("id"):
        # Get user's vehicle IDs
        vehicles = (
            supabase.table("vehicles")
            .select("id")
            .eq("user_id", request.db_user["id"])
            .execute()
        )
        vehicle_ids = [v["id"] for v in vehicles.data]
        if not vehicle_ids:
            return jsonify({"sessions": []}), 200
        query = supabase.table("parking_sessions").select("*").in_("vehicle_id", vehicle_ids)
    else:
        return jsonify({"sessions": []}), 200

    if facility_id:
        query = query.eq("facility_id", facility_id)
    if active_only:
        query = query.is_("exit_time", "null")

    result = query.order("entry_time", desc=True).limit(limit).execute()
    return jsonify({"sessions": result.data}), 200


# ==========================================================================
# 8. PAYMENTS & WALLET
# ==========================================================================

@app.route("/api/wallet", methods=["GET"])
@require_auth
def get_wallet():
    """GET /api/wallet – Get current user's wallet balance."""
    wallet = (
        supabase.table("user_wallets")
        .select("*")
        .eq("user_id", request.db_user["id"])
        .limit(1)
        .execute()
    )
    if not wallet.data:
        return jsonify({"balance": 0, "currency": DEFAULT_CURRENCY}), 200
    return jsonify(wallet.data[0]), 200


@app.route("/api/wallet/topup", methods=["POST"])
@require_auth
def topup_wallet():
    """
    POST /api/wallet/topup
    Add funds to wallet.

    Body: { "amount": 1000, "payment_method"?: "card"|"bank_transfer" }
    """
    data = request.get_json()
    amount = data.get("amount")
    if not amount or amount <= 0:
        return jsonify({"message": "A positive amount is required"}), 400

    wallet = (
        supabase.table("user_wallets")
        .select("*")
        .eq("user_id", request.db_user["id"])
        .limit(1)
        .execute()
    )
    if not wallet.data:
        return jsonify({"message": "Wallet not found"}), 404

    new_balance = wallet.data[0]["balance"] + amount
    supabase.table("user_wallets").update({
        "balance": new_balance,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", wallet.data[0]["id"]).execute()

    # Record payment
    supabase.table("payments").insert({
        "user_id": request.db_user["id"],
        "amount": amount,
        "payment_method": data.get("payment_method", "card"),
        "payment_status": "completed",
        "description": "Wallet top-up",
    }).execute()

    _create_notification(
        request.db_user["id"],
        "Wallet Topped Up",
        f"LKR {amount} added to your wallet. New balance: LKR {new_balance}.",
        "payment",
        {"amount": amount, "new_balance": new_balance},
    )

    return jsonify({"message": "Wallet topped up", "new_balance": new_balance}), 200


@app.route("/api/payments", methods=["GET"])
@require_auth
def get_payments():
    """GET /api/payments – Payment history for the current user (or all for admin)."""
    if request.args.get("all") == "true" and request.db_user["role"] in ("admin", "operator"):
        query = supabase.table("payments").select("*, users(email, full_name)")
    else:
        query = supabase.table("payments").select("*").eq("user_id", request.db_user["id"])

    result = query.order("created_at", desc=True).limit(100).execute()
    return jsonify({"payments": result.data}), 200


# ==========================================================================
# 9. SUBSCRIPTIONS
# ==========================================================================

@app.route("/api/subscriptions", methods=["POST"])
@require_auth
def create_subscription():
    """
    POST /api/subscriptions
    Purchase a monthly pass.

    Body: { "facility_id", "vehicle_id", "plan_id" }
    """
    data = request.get_json()
    facility_id = data.get("facility_id")
    vehicle_id = data.get("vehicle_id")
    plan_id = data.get("plan_id")

    if not all([facility_id, vehicle_id, plan_id]):
        return jsonify({"message": "facility_id, vehicle_id, and plan_id are required"}), 400

    # Get plan details
    plan = supabase.table("pricing_plans").select("*").eq("id", plan_id).limit(1).execute()
    if not plan.data or plan.data[0]["plan_type"] != "monthly":
        return jsonify({"message": "Invalid monthly plan"}), 400

    amount = plan.data[0]["rate"]
    start_date = datetime.now(timezone.utc).date()
    end_date = start_date + timedelta(days=30)

    # Check wallet balance
    wallet = (
        supabase.table("user_wallets")
        .select("*")
        .eq("user_id", request.db_user["id"])
        .limit(1)
        .execute()
    )
    if not wallet.data or wallet.data[0]["balance"] < amount:
        return jsonify({"message": f"Insufficient wallet balance. Need LKR {amount}"}), 400

    # Deduct from wallet
    new_balance = wallet.data[0]["balance"] - amount
    supabase.table("user_wallets").update({
        "balance": new_balance,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", wallet.data[0]["id"]).execute()

    # Create subscription
    sub = {
        "user_id": request.db_user["id"],
        "facility_id": facility_id,
        "vehicle_id": vehicle_id,
        "plan_id": plan_id,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "status": "active",
    }
    result = supabase.table("subscriptions").insert(sub).execute()

    # Record payment
    supabase.table("payments").insert({
        "user_id": request.db_user["id"],
        "subscription_id": result.data[0]["id"],
        "amount": amount,
        "payment_method": "wallet",
        "payment_status": "completed",
        "description": f"Monthly pass: {plan.data[0]['name']}",
    }).execute()

    _create_notification(
        request.db_user["id"],
        "Subscription Activated",
        f"Monthly pass active until {end_date.isoformat()}. Amount: LKR {amount}.",
        "subscription",
        {"subscription_id": result.data[0]["id"]},
    )

    return jsonify({"message": "Subscription created", "subscription": result.data[0]}), 201


@app.route("/api/subscriptions", methods=["GET"])
@require_auth
def get_subscriptions():
    """GET /api/subscriptions – Get user's subscriptions (or all for admin)."""
    if request.args.get("all") == "true" and request.db_user["role"] in ("admin", "operator"):
        query = supabase.table("subscriptions").select("*, users(email, full_name), vehicles(plate_number), facilities(name), pricing_plans(name, rate)")
    else:
        query = (
            supabase.table("subscriptions")
            .select("*, vehicles(plate_number), facilities(name), pricing_plans(name, rate)")
            .eq("user_id", request.db_user["id"])
        )
    result = query.order("created_at", desc=True).execute()
    return jsonify({"subscriptions": result.data}), 200


@app.route("/api/subscriptions/<int:sub_id>", methods=["PUT"])
@require_auth
def update_subscription(sub_id):
    """PUT /api/subscriptions/:id – Cancel or update auto-renew."""
    data = request.get_json()
    updates = {}
    if data.get("action") == "cancel":
        updates["status"] = "cancelled"
    if "auto_renew" in data:
        updates["auto_renew"] = bool(data["auto_renew"])
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        supabase.table("subscriptions").update(updates).eq("id", sub_id).execute()
    return jsonify({"message": "Subscription updated"}), 200


# ==========================================================================
# 10. CAMERAS (Admin)
# ==========================================================================

@app.route("/api/cameras", methods=["GET"])
@require_admin
def get_cameras():
    """GET /api/cameras – List all cameras, optionally filtered by facility."""
    facility_id = request.args.get("facility_id", type=int)
    query = supabase.table("cameras").select("*").order("id")
    if facility_id:
        query = query.eq("facility_id", facility_id)
    result = query.execute()
    return jsonify({"cameras": result.data}), 200


@app.route("/api/cameras", methods=["POST"])
@require_admin
def add_camera():
    """POST /api/cameras – Add a new camera."""
    data = request.get_json()
    if not all([data.get("camera_id"), data.get("name"), data.get("camera_type"), data.get("facility_id")]):
        return jsonify({"message": "camera_id, name, camera_type, and facility_id are required"}), 400
    if data["camera_type"] not in ("entry", "exit", "monitoring"):
        return jsonify({"message": "camera_type must be entry, exit, or monitoring"}), 400

    camera = {
        "facility_id": data["facility_id"],
        "camera_id": data["camera_id"],
        "name": data["name"],
        "camera_type": data["camera_type"],
        "source_url": data.get("source_url", ""),
        "gate_id": data.get("gate_id"),
        "is_active": True,
    }
    result = supabase.table("cameras").insert(camera).execute()
    return jsonify({"message": "Camera added", "camera": result.data[0]}), 201


@app.route("/api/cameras/<int:camera_id>", methods=["DELETE"])
@require_admin
def delete_camera(camera_id):
    """DELETE /api/cameras/:id – Remove a camera."""
    supabase.table("cameras").delete().eq("id", camera_id).execute()
    return jsonify({"message": "Camera deleted"}), 200


# ==========================================================================
# 11. GATES
# ==========================================================================

@app.route("/api/gates", methods=["GET"])
@require_admin
def get_gates():
    """GET /api/gates – List all gates, optionally by facility."""
    facility_id = request.args.get("facility_id", type=int)
    query = supabase.table("gates").select("*").order("id")
    if facility_id:
        query = query.eq("facility_id", facility_id)
    result = query.execute()
    return jsonify({"gates": result.data}), 200


@app.route("/api/gates", methods=["POST"])
@require_admin
def add_gate():
    """POST /api/gates – Add a new gate."""
    data = request.get_json()
    if not all([data.get("name"), data.get("gate_type"), data.get("facility_id")]):
        return jsonify({"message": "name, gate_type, and facility_id are required"}), 400

    gate = {
        "facility_id": data["facility_id"],
        "name": data["name"],
        "gate_type": data["gate_type"],
        "hardware_ip": data.get("hardware_ip"),
        "camera_id": data.get("camera_id"),
    }
    result = supabase.table("gates").insert(gate).execute()
    return jsonify({"message": "Gate added", "gate": result.data[0]}), 201


@app.route("/api/gates/<int:gate_id>/open", methods=["POST"])
@require_admin
def open_gate(gate_id):
    """POST /api/gates/:id/open – Manually open a gate."""
    supabase.table("gates").update({"status": "open"}).eq("id", gate_id).execute()

    supabase.table("gate_events").insert({
        "gate_id": gate_id,
        "event_type": "open",
        "triggered_by": "manual",
        "operator_id": request.db_user["id"],
        "plate_number": request.get_json().get("plate_number") if request.get_json() else None,
    }).execute()

    return jsonify({"message": "Gate opened"}), 200


@app.route("/api/gates/<int:gate_id>/close", methods=["POST"])
@require_admin
def close_gate(gate_id):
    """POST /api/gates/:id/close – Manually close a gate."""
    supabase.table("gates").update({"status": "closed"}).eq("id", gate_id).execute()

    supabase.table("gate_events").insert({
        "gate_id": gate_id,
        "event_type": "close",
        "triggered_by": "manual",
        "operator_id": request.db_user["id"],
    }).execute()

    return jsonify({"message": "Gate closed"}), 200


# ==========================================================================
# 12. DETECTION LOGS
# ==========================================================================

@app.route("/api/detections", methods=["GET"])
@require_admin
def get_detections():
    """GET /api/detections – Get LPR detection logs."""
    limit = request.args.get("limit", 50, type=int)
    facility_id = request.args.get("facility_id", type=int)

    query = supabase.table("detection_logs").select("*").order("detected_at", desc=True).limit(limit)
    if facility_id:
        query = query.eq("facility_id", facility_id)
    result = query.execute()
    return jsonify({"detections": result.data}), 200


@app.route("/api/detections", methods=["POST"])
def add_detection():
    """
    POST /api/detections
    Log a plate detection event from the LPR service.
    PUBLIC endpoint (no auth) for the AI service.

    Body: { "camera_id", "facility_id", "plate_number", "confidence",
            "vehicle_class"?, "image_url"? }

    Auto-checks if the plate is registered and flags it.
    """
    data = request.get_json()
    camera_id = data.get("camera_id")
    plate = data.get("plate_number")

    if not camera_id or not plate:
        return jsonify({"message": "camera_id and plate_number are required"}), 400

    # Check if plate is registered
    vehicle = (
        supabase.table("vehicles")
        .select("id")
        .eq("plate_number", plate)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    is_registered = len(vehicle.data) > 0
    vehicle_id = vehicle.data[0]["id"] if vehicle.data else None

    log = {
        "camera_id": camera_id,
        "facility_id": data.get("facility_id"),
        "plate_number": plate,
        "confidence": data.get("confidence", 0.0),
        "vehicle_id": vehicle_id,
        "is_registered": is_registered,
        "detected_at": datetime.now(timezone.utc).isoformat(),
        "action_taken": "pending",
        "vehicle_class": data.get("vehicle_class"),
        "image_url": data.get("image_url"),
    }
    result = supabase.table("detection_logs").insert(log).execute()

    return jsonify({
        "message": "Detection logged",
        "id": result.data[0]["id"],
        "is_registered": is_registered,
    }), 201


@app.route("/api/detections/<int:log_id>/action", methods=["PATCH"])
@require_admin
def update_detection_action(log_id):
    """PATCH /api/detections/:id/action – Approve/reject a detection."""
    data = request.get_json()
    action = data.get("action")
    if action not in ("entry", "exit", "ignored", "gate_opened"):
        return jsonify({"message": "Invalid action"}), 400

    supabase.table("detection_logs").update({"action_taken": action}).eq("id", log_id).execute()
    return jsonify({"message": f"Action updated to {action}"}), 200


# ==========================================================================
# 13. NOTIFICATIONS
# ==========================================================================

@app.route("/api/notifications", methods=["GET"])
@require_auth
def get_notifications():
    """GET /api/notifications – Get current user's notifications."""
    limit = request.args.get("limit", 50, type=int)
    result = (
        supabase.table("notifications")
        .select("*")
        .eq("user_id", request.db_user["id"])
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return jsonify({"notifications": result.data}), 200


@app.route("/api/notifications/<int:notif_id>/read", methods=["PUT"])
@require_auth
def mark_notification_read(notif_id):
    """PUT /api/notifications/:id/read – Mark one notification as read."""
    supabase.table("notifications").update({"is_read": True}).eq("id", notif_id).execute()
    return jsonify({"message": "Marked as read"}), 200


@app.route("/api/notifications/read-all", methods=["PUT"])
@require_auth
def mark_all_notifications_read():
    """PUT /api/notifications/read-all – Mark all notifications as read."""
    supabase.table("notifications").update({"is_read": True}).eq(
        "user_id", request.db_user["id"]
    ).eq("is_read", False).execute()
    return jsonify({"message": "All notifications marked as read"}), 200


# ==========================================================================
# 14. DASHBOARD / ANALYTICS (Admin)
# ==========================================================================

@app.route("/api/dashboard/stats", methods=["GET"])
@require_admin
def dashboard_stats():
    """
    GET /api/dashboard/stats?facility_id=1
    Get dashboard statistics for a facility.
    """
    facility_id = request.args.get("facility_id", type=int)
    if not facility_id:
        return jsonify({"message": "facility_id is required"}), 400

    # Spots summary
    spots = (
        supabase.table("parking_spots")
        .select("is_occupied, is_reserved")
        .eq("facility_id", facility_id)
        .eq("is_active", True)
        .execute()
    )
    total_spots = len(spots.data)
    occupied = sum(1 for s in spots.data if s["is_occupied"])
    reserved = sum(1 for s in spots.data if s["is_reserved"] and not s["is_occupied"])
    available = total_spots - occupied - reserved

    # Today's sessions and revenue
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
    today_sessions = (
        supabase.table("parking_sessions")
        .select("amount, payment_status")
        .eq("facility_id", facility_id)
        .gte("entry_time", today_start)
        .execute()
    )
    today_entries = len(today_sessions.data)
    today_revenue = sum(s.get("amount", 0) or 0 for s in today_sessions.data if s.get("payment_status") == "paid")

    # Active sessions
    active_sessions = (
        supabase.table("parking_sessions")
        .select("id")
        .eq("facility_id", facility_id)
        .is_("exit_time", "null")
        .execute()
    )

    # Today's reservations
    today_reservations = (
        supabase.table("reservations")
        .select("id")
        .eq("facility_id", facility_id)
        .gte("reserved_start", today_start)
        .execute()
    )

    # Registered users count
    total_users = supabase.table("users").select("id").eq("role", "user").execute()
    total_vehicles = supabase.table("vehicles").select("id").eq("is_active", True).execute()

    return jsonify({
        "spots": {
            "total": total_spots,
            "occupied": occupied,
            "reserved": reserved,
            "available": available,
        },
        "today": {
            "entries": today_entries,
            "revenue": today_revenue,
            "active_sessions": len(active_sessions.data),
            "reservations": len(today_reservations.data),
        },
        "system": {
            "total_users": len(total_users.data),
            "total_vehicles": len(total_vehicles.data),
        },
    }), 200


@app.route("/api/dashboard/recent-activity", methods=["GET"])
@require_admin
def recent_activity():
    """GET /api/dashboard/recent-activity – Recent sessions, detections, gate events."""
    facility_id = request.args.get("facility_id", type=int)
    limit = request.args.get("limit", 20, type=int)

    sessions = (
        supabase.table("parking_sessions")
        .select("*")
        .order("entry_time", desc=True)
        .limit(limit)
    )
    if facility_id:
        sessions = sessions.eq("facility_id", facility_id)
    sessions = sessions.execute()

    detections = (
        supabase.table("detection_logs")
        .select("*")
        .order("detected_at", desc=True)
        .limit(limit)
    )
    if facility_id:
        detections = detections.eq("facility_id", facility_id)
    detections = detections.execute()

    return jsonify({
        "recent_sessions": sessions.data,
        "recent_detections": detections.data,
    }), 200


# ==========================================================================
# 15. SYSTEM
# ==========================================================================

@app.route("/api/system/reset", methods=["POST"])
@require_admin
def reset_system():
    """POST /api/system/reset – Clear all sessions, free all spots. DESTRUCTIVE."""
    facility_id = request.get_json().get("facility_id") if request.get_json() else None

    try:
        if facility_id:
            supabase.table("parking_sessions").delete().eq("facility_id", facility_id).neq("id", 0).execute()
            supabase.table("reservations").delete().eq("facility_id", facility_id).neq("id", 0).execute()
            supabase.table("parking_spots").update({
                "is_occupied": False,
                "is_reserved": False,
            }).eq("facility_id", facility_id).neq("id", 0).execute()
        else:
            supabase.table("parking_sessions").delete().neq("id", 0).execute()
            supabase.table("reservations").delete().neq("id", 0).execute()
            supabase.table("parking_spots").update({
                "is_occupied": False,
                "is_reserved": False,
            }).neq("id", 0).execute()

        return jsonify({"message": "System reset! All spots are now free."}), 200
    except Exception as e:
        return jsonify({"message": f"Reset failed: {str(e)}"}), 500


@app.route("/api/lpr/status", methods=["GET"])
@require_admin
def lpr_status():
    """GET /api/lpr/status – Health check for SentraAI LPR service."""
    try:
        response = httpx.get(f"{LPR_SERVICE_URL}/api/health", timeout=5.0)
        if response.status_code == 200:
            data = response.json()
            return jsonify({"connected": True, **data}), 200
        return jsonify({"connected": False, "message": "Service unavailable"}), 503
    except Exception as e:
        return jsonify({"connected": False, "message": str(e)}), 503


# ==========================================================================
# BACKWARD COMPATIBILITY – Old endpoint aliases
# ==========================================================================
# These redirect the old v1 endpoints to the new structure so existing
# frontend code keeps working during the migration.

@app.route("/api/signup", methods=["POST"])
def signup_compat():
    """Backward compat: /api/signup → /api/auth/signup"""
    return signup()

@app.route("/api/login", methods=["POST"])
def login_compat():
    """Backward compat: /api/login → /api/auth/login"""
    return login()

@app.route("/api/spots", methods=["GET"])
@require_auth
def get_spots_compat():
    """Backward compat: /api/spots → returns spots for facility 1."""
    # Find first facility
    facility = supabase.table("facilities").select("id").limit(1).execute()
    if not facility.data:
        return jsonify({"spots": []}), 200
    facility_id = facility.data[0]["id"]

    result = supabase.table("parking_spots").select("*").eq("facility_id", facility_id).order("id").execute()
    output = [{"id": s["id"], "name": s["spot_name"], "is_occupied": s["is_occupied"]} for s in result.data]
    return jsonify({"spots": output}), 200

@app.route("/api/init-spots", methods=["POST"])
def init_spots_compat():
    """Backward compat: /api/init-spots → creates facility + spots."""
    # Create default facility if none exists
    existing = supabase.table("facilities").select("id").limit(1).execute()
    if not existing.data:
        supabase.table("facilities").insert({
            "name": "Sentra Main Parking",
            "address": "Main Street",
            "city": "Colombo",
            "total_spots": 32,
            "hourly_rate": DEFAULT_HOURLY_RATE,
        }).execute()
        existing = supabase.table("facilities").select("id").limit(1).execute()

    facility_id = existing.data[0]["id"]

    # Check if spots exist
    spots = supabase.table("parking_spots").select("id").eq("facility_id", facility_id).limit(1).execute()
    if spots.data:
        return jsonify({"message": "Spots already initialized!"}), 400

    spot_list = []
    for i in range(1, 33):
        spot_list.append({
            "facility_id": facility_id,
            "spot_name": f"A-{str(i).zfill(2)}",
            "is_occupied": False,
        })
    supabase.table("parking_spots").insert(spot_list).execute()
    return jsonify({"message": "32 Parking spots created successfully!"}), 201

@app.route("/api/vehicle/entry", methods=["POST"])
def vehicle_entry_compat():
    """Backward compat: /api/vehicle/entry → /api/sessions/entry"""
    data = request.get_json() or {}
    # Add default facility_id if not present
    if "facility_id" not in data:
        facility = supabase.table("facilities").select("id").limit(1).execute()
        if facility.data:
            data["facility_id"] = facility.data[0]["id"]
        else:
            return jsonify({"message": "No facility exists. Run /api/init-spots first."}), 400

    # Temporarily override request data
    original_json = request.get_json
    request.get_json = lambda *a, **kw: data
    result = vehicle_entry()
    request.get_json = original_json
    return result

@app.route("/api/vehicle/exit", methods=["POST"])
def vehicle_exit_compat():
    """Backward compat: /api/vehicle/exit → /api/sessions/exit"""
    return vehicle_exit()

@app.route("/api/logs", methods=["GET"])
@require_auth
def get_logs_compat():
    """Backward compat: /api/logs → returns recent sessions for facility 1."""
    facility = supabase.table("facilities").select("id").limit(1).execute()
    fid = facility.data[0]["id"] if facility.data else None

    query = supabase.table("parking_sessions").select("*").order("entry_time", desc=True).limit(50)
    if fid:
        query = query.eq("facility_id", fid)
    result = query.execute()

    output = []
    for s in result.data:
        output.append({
            "id": s["id"],
            "plate_number": s["plate_number"],
            "spot": s["spot_name"],
            "entry_time": s["entry_time"],
            "exit_time": s.get("exit_time"),
            "duration_minutes": s.get("duration_minutes"),
            "amount_lkr": s.get("amount"),
        })
    return jsonify({"logs": output}), 200

@app.route("/api/reset-system", methods=["POST"])
def reset_system_compat():
    """Backward compat: /api/reset-system (no auth for compat)."""
    try:
        supabase.table("parking_sessions").delete().neq("id", 0).execute()
        supabase.table("reservations").delete().neq("id", 0).execute()
        supabase.table("parking_spots").update({"is_occupied": False, "is_reserved": False}).neq("id", 0).execute()
        return jsonify({"message": "System reset! All spots are now free."}), 200
    except Exception as e:
        return jsonify({"message": f"Reset failed: {str(e)}"}), 500

@app.route("/api/detection-logs", methods=["GET"])
@require_auth
def get_detection_logs_compat():
    """Backward compat: /api/detection-logs"""
    limit = request.args.get("limit", 50, type=int)
    result = supabase.table("detection_logs").select("*").order("detected_at", desc=True).limit(limit).execute()
    return jsonify({"logs": result.data}), 200

@app.route("/api/detection-logs", methods=["POST"])
def add_detection_log_compat():
    """Backward compat: /api/detection-logs → /api/detections"""
    return add_detection()

@app.route("/api/detection-logs/<int:log_id>/action", methods=["PATCH"])
@require_admin
def update_detection_compat(log_id):
    """Backward compat: /api/detection-logs/:id/action"""
    return update_detection_action(log_id)


# ==========================================================================
# HELPER FUNCTIONS
# ==========================================================================

def _create_notification(user_id, title, message, notif_type="system", data=None):
    """Helper: create a notification for a user."""
    try:
        supabase.table("notifications").insert({
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": notif_type,
            "data": data,
        }).execute()
    except Exception:
        pass  # Non-critical: don't fail the main operation
