"""
routes_compat.py - Backward compatibility endpoints
===================================================
Legacy endpoint aliases for v1 clients.
"""

from flask import request, jsonify
from app import app, supabase
from routes_common import require_auth, require_admin, DEFAULT_HOURLY_RATE
from routes_auth import signup, login
from routes_sessions import vehicle_entry, vehicle_exit
from routes_detections import add_detection, update_detection_action


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

    result = (
        supabase.table("parking_spots")
        .select("*")
        .eq("facility_id", facility_id)
        .order("id")
        .execute()
    )
    output = [
        {"id": s["id"], "name": s["spot_name"], "is_occupied": s["is_occupied"]}
        for s in result.data
    ]
    return jsonify({"spots": output}), 200


@app.route("/api/init-spots", methods=["POST"])
def init_spots_compat():
    """Backward compat: /api/init-spots → creates facility + spots."""
    # Create default facility if none exists
    existing = supabase.table("facilities").select("id").limit(1).execute()
    if not existing.data:
        supabase.table("facilities").insert(
            {
                "name": "Sentra Main Parking",
                "address": "Main Street",
                "city": "Colombo",
                "total_spots": 32,
                "hourly_rate": DEFAULT_HOURLY_RATE,
            }
        ).execute()
        existing = supabase.table("facilities").select("id").limit(1).execute()

    facility_id = existing.data[0]["id"]

    # Check if spots exist
    spots = (
        supabase.table("parking_spots")
        .select("id")
        .eq("facility_id", facility_id)
        .limit(1)
        .execute()
    )
    if spots.data:
        return jsonify({"message": "Spots already initialized!"}), 400

    spot_list = []
    for i in range(1, 33):
        spot_list.append(
            {
                "facility_id": facility_id,
                "spot_name": f"A-{str(i).zfill(2)}",
                "is_occupied": False,
            }
        )
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
            return (
                jsonify({"message": "No facility exists. Run /api/init-spots first."}),
                400,
            )

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

    query = (
        supabase.table("parking_sessions")
        .select("*")
        .order("entry_time", desc=True)
        .limit(50)
    )
    if fid:
        query = query.eq("facility_id", fid)
    result = query.execute()

    output = []
    for s in result.data:
        output.append(
            {
                "id": s["id"],
                "plate_number": s["plate_number"],
                "spot": s["spot_name"],
                "entry_time": s["entry_time"],
                "exit_time": s.get("exit_time"),
                "duration_minutes": s.get("duration_minutes"),
                "amount_lkr": s.get("amount"),
            }
        )
    return jsonify({"logs": output}), 200


@app.route("/api/reset-system", methods=["POST"])
def reset_system_compat():
    """Backward compat: /api/reset-system (no auth for compat)."""
    try:
        supabase.table("parking_sessions").delete().neq("id", 0).execute()
        supabase.table("reservations").delete().neq("id", 0).execute()
        supabase.table("parking_spots").update(
            {"is_occupied": False, "is_reserved": False}
        ).neq("id", 0).execute()
        return jsonify({"message": "System reset! All spots are now free."}), 200
    except Exception as e:
        return jsonify({"message": f"Reset failed: {str(e)}"}), 500


@app.route("/api/detection-logs", methods=["GET"])
@require_auth
def get_detection_logs_compat():
    """Backward compat: /api/detection-logs"""
    limit = request.args.get("limit", 50, type=int)
    result = (
        supabase.table("detection_logs")
        .select("*")
        .order("detected_at", desc=True)
        .limit(limit)
        .execute()
    )
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
