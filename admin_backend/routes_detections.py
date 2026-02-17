"""
routes_detections.py - Detection log endpoints
==============================================
Endpoints for LPR detection logs.
"""

from datetime import datetime, timezone
from flask import request, jsonify
from app import app, supabase
from routes_common import require_admin

# ==========================================================================
# 12. DETECTION LOGS
# ==========================================================================


@app.route("/api/detections", methods=["GET"])
@require_admin
def get_detections():
    """GET /api/detections – Get LPR detection logs."""
    limit = request.args.get("limit", 50, type=int)
    facility_id = request.args.get("facility_id", type=int)

    query = (
        supabase.table("detection_logs")
        .select("*")
        .order("detected_at", desc=True)
        .limit(limit)
    )
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

    return (
        jsonify(
            {
                "message": "Detection logged",
                "id": result.data[0]["id"],
                "is_registered": is_registered,
            }
        ),
        201,
    )


@app.route("/api/detections/<int:log_id>/action", methods=["PATCH"])
@require_admin
def update_detection_action(log_id):
    """PATCH /api/detections/:id/action – Approve/reject a detection."""
    data = request.get_json()
    action = data.get("action")
    if action not in ("entry", "exit", "ignored", "gate_opened"):
        return jsonify({"message": "Invalid action"}), 400

    supabase.table("detection_logs").update({"action_taken": action}).eq(
        "id", log_id
    ).execute()
    return jsonify({"message": f"Action updated to {action}"}), 200
