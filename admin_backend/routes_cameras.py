"""
routes_cameras.py - Camera management
=====================================
Admin endpoints for camera configuration.
"""

from flask import request, jsonify
from app import app, supabase
from routes_common import require_admin

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
    if not all(
        [
            data.get("camera_id"),
            data.get("name"),
            data.get("camera_type"),
            data.get("facility_id"),
        ]
    ):
        return (
            jsonify(
                {
                    "message": "camera_id, name, camera_type, and facility_id are required"
                }
            ),
            400,
        )
    if data["camera_type"] not in ("entry", "exit", "monitoring"):
        return (
            jsonify({"message": "camera_type must be entry, exit, or monitoring"}),
            400,
        )

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
