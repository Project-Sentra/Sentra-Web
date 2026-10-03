"""
routes_gates.py - Gate management
=================================
Admin endpoints for gates, manual barrier control (FR-12) and the gate
event log. Automatic LPR openings are recorded by record_lpr_gate_open().
"""

from flask import request, jsonify
from app import app, supabase
from routes_common import require_admin, get_json_body

GATE_TYPES = ("entry", "exit", "bidirectional")

# ==========================================================================
# 11. GATES
# ==========================================================================


def _load_gate(gate_id):
    result = supabase.table("gates").select("*").eq("id", gate_id).limit(1).execute()
    return result.data[0] if result.data else None


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
    data = get_json_body()
    name = (data.get("name") or "").strip()
    if not all([name, data.get("gate_type"), data.get("facility_id")]):
        return (
            jsonify({"message": "name, gate_type, and facility_id are required"}),
            400,
        )
    if data["gate_type"] not in GATE_TYPES:
        return (
            jsonify({"message": f"gate_type must be one of {', '.join(GATE_TYPES)}"}),
            400,
        )

    gate = {
        "facility_id": data["facility_id"],
        "name": name,
        "gate_type": data["gate_type"],
        "hardware_ip": data.get("hardware_ip"),
        "camera_id": data.get("camera_id"),
    }
    result = supabase.table("gates").insert(gate).execute()
    return jsonify({"message": "Gate added", "gate": result.data[0]}), 201


# gates.status uses open/closed; gate_events.event_type uses open/close
EVENT_FOR_STATUS = {"open": "open", "closed": "close"}


def _set_gate_status(gate_id, status, plate_number=None):
    """Manually open or close a gate and log who did it."""
    gate = _load_gate(gate_id)
    if not gate:
        return jsonify({"message": "Gate not found"}), 404

    updated = (
        supabase.table("gates").update({"status": status}).eq("id", gate_id).execute()
    )
    supabase.table("gate_events").insert(
        {
            "gate_id": gate_id,
            "event_type": EVENT_FOR_STATUS[status],
            "triggered_by": "manual",
            "operator_id": request.db_user["id"],
            "plate_number": plate_number,
        }
    ).execute()

    gate = updated.data[0] if updated.data else {**gate, "status": status}
    return jsonify({"message": f"Gate {status}", "gate": gate}), 200


@app.route("/api/gates/<int:gate_id>/open", methods=["POST"])
@require_admin
def open_gate(gate_id):
    """POST /api/gates/:id/open – Manually open a gate."""
    plate = (get_json_body().get("plate_number") or "").strip().upper() or None
    return _set_gate_status(gate_id, "open", plate)


@app.route("/api/gates/<int:gate_id>/close", methods=["POST"])
@require_admin
def close_gate(gate_id):
    """POST /api/gates/:id/close – Manually close a gate."""
    return _set_gate_status(gate_id, "closed")


@app.route("/api/gates/events", methods=["GET"])
@require_admin
def get_gate_events():
    """
    GET /api/gates/events – Recent gate events, newest first.
    Query params: ?facility_id=1&gate_id=2&limit=50
    """
    limit = min(max(request.args.get("limit", 50, type=int), 1), 200)
    gate_id = request.args.get("gate_id", type=int)
    facility_id = request.args.get("facility_id", type=int)

    query = (
        supabase.table("gate_events")
        .select("*, gates(name, gate_type, facility_id), users(full_name, email)")
        .order("created_at", desc=True)
        .limit(limit)
    )
    if gate_id:
        query = query.eq("gate_id", gate_id)
    events = query.execute().data or []
    if facility_id:
        events = [
            e
            for e in events
            if (e.get("gates") or {}).get("facility_id") == facility_id
        ]
    return jsonify({"events": events}), 200


def record_lpr_gate_open(facility_id, direction, plate_number, vehicle_id=None):
    """
    Log an automatic (LPR) barrier opening for an entry or exit.

    The physical barrier closes by itself once the vehicle has passed, so the
    gate's stored status is left unchanged; only the event is recorded.
    Never raises: a logging problem must not block a vehicle at the gate.
    """
    try:
        gates = (
            supabase.table("gates")
            .select("id, gate_type")
            .eq("facility_id", facility_id)
            .in_("gate_type", [direction, "bidirectional"])
            .order("id")
            .execute()
        ).data or []
        if not gates:
            return
        # Prefer a dedicated entry/exit gate over a bidirectional one
        gate = next((g for g in gates if g["gate_type"] == direction), gates[0])
        supabase.table("gate_events").insert(
            {
                "gate_id": gate["id"],
                "event_type": "open",
                "triggered_by": "auto_lpr",
                "plate_number": plate_number,
                "vehicle_id": vehicle_id,
            }
        ).execute()
    except Exception:  # noqa: BLE001 - see docstring
        app.logger.exception("Could not record LPR gate event")
