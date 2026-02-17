"""
routes_gates.py - Gate management
=================================
Admin endpoints for gates and manual control.
"""

from flask import request, jsonify
from app import app, supabase
from routes_common import require_admin


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
        return (
            jsonify({"message": "name, gate_type, and facility_id are required"}),
            400,
        )

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

    supabase.table("gate_events").insert(
        {
            "gate_id": gate_id,
            "event_type": "open",
            "triggered_by": "manual",
            "operator_id": request.db_user["id"],
            "plate_number": (
                request.get_json().get("plate_number") if request.get_json() else None
            ),
        }
    ).execute()

    return jsonify({"message": "Gate opened"}), 200


@app.route("/api/gates/<int:gate_id>/close", methods=["POST"])
@require_admin
def close_gate(gate_id):
    """POST /api/gates/:id/close – Manually close a gate."""
    supabase.table("gates").update({"status": "closed"}).eq("id", gate_id).execute()

    supabase.table("gate_events").insert(
        {
            "gate_id": gate_id,
            "event_type": "close",
            "triggered_by": "manual",
            "operator_id": request.db_user["id"],
        }
    ).execute()

    return jsonify({"message": "Gate closed"}), 200
