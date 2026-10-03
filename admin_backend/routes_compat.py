"""
routes_compat.py - Backward compatibility endpoints
===================================================
Legacy endpoint aliases for v1 clients (mainly the SentraAI service's
parking_client.py). They delegate to the v2 handlers and apply the same
authentication rules.

The legacy unauthenticated /api/reset-system endpoint has been removed;
use the admin-only POST /api/system/reset instead.
"""

from flask import request, jsonify
from app import app, supabase
from routes_common import (
    require_admin,
    require_service_or_admin,
    get_json_body,
    DEFAULT_HOURLY_RATE,
)
from routes_auth import signup, login
from routes_sessions import process_vehicle_entry, process_vehicle_exit
from routes_detections import process_add_detection, update_detection_action

# ==========================================================================
# BACKWARD COMPATIBILITY – Old endpoint aliases
# ==========================================================================


@app.route("/api/signup", methods=["POST"])
def signup_compat():
    """Backward compat: /api/signup → /api/auth/signup"""
    return signup()


@app.route("/api/login", methods=["POST"])
def login_compat():
    """Backward compat: /api/login → /api/auth/login"""
    return login()


def _first_facility_id():
    facility = supabase.table("facilities").select("id").order("id").limit(1).execute()
    return facility.data[0]["id"] if facility.data else None


@app.route("/api/spots", methods=["GET"])
@require_service_or_admin
def get_spots_compat():
    """Backward compat: /api/spots → returns spots for the first facility."""
    facility_id = _first_facility_id()
    if not facility_id:
        return jsonify({"spots": []}), 200

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
@require_admin
def init_spots_compat():
    """Backward compat: /api/init-spots → creates facility + spots (admin only)."""
    # Create default facility if none exists
    facility_id = _first_facility_id()
    if not facility_id:
        supabase.table("facilities").insert(
            {
                "name": "Sentra Main Parking",
                "address": "Main Street",
                "city": "Colombo",
                "total_spots": 32,
                "hourly_rate": DEFAULT_HOURLY_RATE,
            }
        ).execute()
        facility_id = _first_facility_id()

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
@require_service_or_admin
def vehicle_entry_compat():
    """Backward compat: /api/vehicle/entry → /api/sessions/entry"""
    data = get_json_body()
    if "facility_id" not in data:
        facility_id = _first_facility_id()
        if not facility_id:
            return (
                jsonify({"message": "No facility exists. Create a facility first."}),
                400,
            )
        data["facility_id"] = facility_id
    return process_vehicle_entry(data)


@app.route("/api/vehicle/exit", methods=["POST"])
@require_service_or_admin
def vehicle_exit_compat():
    """Backward compat: /api/vehicle/exit → /api/sessions/exit"""
    return process_vehicle_exit(get_json_body())


@app.route("/api/logs", methods=["GET"])
@require_service_or_admin
def get_logs_compat():
    """Backward compat: /api/logs → returns recent sessions for the first facility."""
    fid = _first_facility_id()

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


@app.route("/api/detection-logs", methods=["GET"])
@require_admin
def get_detection_logs_compat():
    """Backward compat: /api/detection-logs"""
    limit = min(max(request.args.get("limit", 50, type=int), 1), 500)
    result = (
        supabase.table("detection_logs")
        .select("*")
        .order("detected_at", desc=True)
        .limit(limit)
        .execute()
    )
    return jsonify({"logs": result.data}), 200


@app.route("/api/detection-logs", methods=["POST"])
@require_service_or_admin
def add_detection_log_compat():
    """Backward compat: /api/detection-logs → /api/detections"""
    return process_add_detection(get_json_body())


@app.route("/api/detection-logs/<int:log_id>/action", methods=["PATCH"])
@require_admin
def update_detection_compat(log_id):
    """Backward compat: /api/detection-logs/:id/action"""
    return update_detection_action.__wrapped__(log_id)
