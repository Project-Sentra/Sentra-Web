"""
routes_vehicles.py - Vehicle management
=======================================
Endpoints for registering and managing vehicles.
"""

from flask import request, jsonify
from app import app, supabase
from routes_common import (
    require_auth,
    require_service_or_admin,
    get_json_body,
    is_admin_user,
    normalize_plate,
    _create_notification,
)

# ==========================================================================
# 3. VEHICLE MANAGEMENT
# ==========================================================================


def _load_owned_vehicle(vehicle_id):
    """
    Fetch a vehicle the current user may modify.
    Returns (vehicle, None) or (None, (response, status)).
    """
    result = (
        supabase.table("vehicles").select("*").eq("id", vehicle_id).limit(1).execute()
    )
    if not result.data:
        return None, (jsonify({"message": "Vehicle not found"}), 404)
    vehicle = result.data[0]
    if vehicle["user_id"] != request.db_user["id"] and not is_admin_user(
        request.db_user
    ):
        return None, (jsonify({"message": "You do not own this vehicle"}), 403)
    return vehicle, None


@app.route("/api/vehicles", methods=["POST"])
@require_auth
def register_vehicle():
    """
    POST /api/vehicles
    Register a vehicle (adds it to the entry whitelist).
    Users register their own; admins/operators may pass "user_id" to register
    on behalf of a user — it then shows in that user's app.

    Body: { "plate_number", "user_id"?, "make"?, "model"?, "color"?, "year"?, "vehicle_type"? }
    """
    data = get_json_body()
    plate = normalize_plate(str(data.get("plate_number") or ""))
    if not plate:
        return jsonify({"message": "plate_number is required"}), 400
    if len(plate) > 20:
        return jsonify({"message": "plate_number is too long"}), 400

    owner_id = request.db_user["id"]
    by_admin = data.get("user_id") is not None
    if by_admin:
        if not is_admin_user(request.db_user):
            return jsonify({"message": "Admin access required"}), 403
        owner = (
            supabase.table("users")
            .select("id")
            .eq("id", data["user_id"])
            .limit(1)
            .execute()
        )
        if not owner.data:
            return jsonify({"message": "Owner user not found"}), 404
        owner_id = owner.data[0]["id"]

    # Check if plate already registered
    existing = (
        supabase.table("vehicles")
        .select("id, is_active")
        .eq("plate_number", plate)
        .limit(1)
        .execute()
    )
    if existing.data:
        hint = (
            ""
            if existing.data[0]["is_active"]
            else " (inactive — reactivate it instead)"
        )
        return jsonify({"message": f"Vehicle {plate} is already registered{hint}"}), 409

    vehicle = {
        "user_id": owner_id,
        "plate_number": plate,
        "make": data.get("make", ""),
        "model": data.get("model", ""),
        "color": data.get("color", ""),
        "year": data.get("year"),
        "vehicle_type": data.get("vehicle_type", "car"),
    }
    result = supabase.table("vehicles").insert(vehicle).execute()

    if by_admin:
        _create_notification(
            owner_id,
            "Vehicle Registered",
            f"Your vehicle {plate} was registered by the parking admin and can now enter.",
            "system",
            {"vehicle_id": result.data[0]["id"]},
        )
    return jsonify({"message": "Vehicle registered", "vehicle": result.data[0]}), 201


@app.route("/api/vehicles", methods=["GET"])
@require_auth
def get_vehicles():
    """
    GET /api/vehicles
    - Regular users: returns only their vehicles
    - Admin: returns all vehicles (with ?all=true) or their own
    """
    if request.args.get("all") == "true" and is_admin_user(request.db_user):
        result = (
            supabase.table("vehicles")
            .select("*, users(email, full_name)")
            .order("created_at", desc=True)
            .execute()
        )
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
    """PUT /api/vehicles/:id – Update vehicle details (owner or admin)."""
    _, error = _load_owned_vehicle(vehicle_id)
    if error:
        return error

    data = get_json_body()
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
    """DELETE /api/vehicles/:id – Deactivate (soft-delete) a vehicle (owner or admin)."""
    _, error = _load_owned_vehicle(vehicle_id)
    if error:
        return error

    supabase.table("vehicles").update({"is_active": False}).eq(
        "id", vehicle_id
    ).execute()
    return jsonify({"message": "Vehicle deactivated"}), 200


@app.route("/api/vehicles/lookup/<plate_number>", methods=["GET"])
@require_service_or_admin
def lookup_vehicle(plate_number):
    """
    GET /api/vehicles/lookup/:plate
    Look up a vehicle by plate number. Used by LPR service to check
    if a detected plate belongs to a registered user.

    Requires the SentraAI service key or an admin JWT (returns owner contact details).
    """
    plate_number = normalize_plate(plate_number)
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

    return (
        jsonify(
            {
                "registered": True,
                "vehicle": vehicle,
                "has_subscription": len(sub.data) > 0,
                "subscription": sub.data[0] if sub.data else None,
            }
        ),
        200,
    )
