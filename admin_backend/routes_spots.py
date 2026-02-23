"""
routes_spots.py - Parking spot management
=========================================
Full CRUD endpoints for parking spots (slots).
Admins can create, read, update, and delete individual spots,
initialise spots in bulk, and adjust the total slot count.
"""

from datetime import datetime, timezone
from flask import request, jsonify
from app import app, supabase
from routes_common import require_admin

# ==========================================================================
# 5. PARKING SPOTS – Full CRUD
# ==========================================================================


@app.route("/api/facilities/<int:facility_id>/spots", methods=["GET"])
def get_spots(facility_id):
    """GET /api/facilities/:id/spots – Get all spots for a facility."""
    include_inactive = request.args.get("include_inactive") == "true"

    query = (
        supabase.table("parking_spots")
        .select("*")
        .eq("facility_id", facility_id)
        .order("spot_name")
    )
    if not include_inactive:
        query = query.eq("is_active", True)

    result = query.execute()
    return jsonify({"spots": result.data}), 200


@app.route("/api/facilities/<int:facility_id>/spots", methods=["POST"])
@require_admin
def create_spot(facility_id):
    """
    POST /api/facilities/:id/spots
    Create one or more individual parking spots.

    Body: { "spot_name": "B-05", "spot_type"?: "regular", "floor_id"?: 1 }
      or: { "spots": [ { "spot_name": "B-05", ... }, ... ] }
    """
    data = request.get_json() or {}

    # Support batch or single creation
    spot_list = data.get("spots", [data] if "spot_name" in data else [])
    if not spot_list:
        return jsonify({"message": "spot_name is required"}), 400

    rows = []
    for s in spot_list:
        if not s.get("spot_name"):
            return jsonify({"message": "spot_name is required for every spot"}), 400
        rows.append(
            {
                "facility_id": facility_id,
                "floor_id": s.get("floor_id"),
                "spot_name": s["spot_name"],
                "spot_type": s.get("spot_type", "regular"),
                "is_occupied": False,
                "is_reserved": False,
                "is_active": True,
            }
        )

    result = supabase.table("parking_spots").insert(rows).execute()

    # Recalculate facility total
    _sync_facility_total(facility_id)

    return (
        jsonify(
            {
                "message": f"{len(rows)} spot(s) created",
                "spots": result.data,
            }
        ),
        201,
    )


@app.route("/api/facilities/<int:facility_id>/spots/init", methods=["POST"])
@require_admin
def init_spots(facility_id):
    """
    POST /api/facilities/:id/spots/init
    Initialize parking spots for a facility in bulk.

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
        spots.append(
            {
                "facility_id": facility_id,
                "floor_id": floor_id,
                "spot_name": f"{prefix}-{str(i).zfill(2)}",
                "spot_type": spot_type,
                "is_occupied": False,
                "is_reserved": False,
            }
        )

    supabase.table("parking_spots").insert(spots).execute()

    # Update facility total
    supabase.table("facilities").update({"total_spots": count}).eq(
        "id", facility_id
    ).execute()

    return jsonify({"message": f"{count} spots created"}), 201


@app.route("/api/spots/<int:spot_id>", methods=["GET"])
def get_spot(spot_id):
    """GET /api/spots/:id – Get a single spot by ID."""
    result = (
        supabase.table("parking_spots")
        .select("*")
        .eq("id", spot_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        return jsonify({"message": "Spot not found"}), 404
    return jsonify({"spot": result.data[0]}), 200


@app.route("/api/spots/<int:spot_id>", methods=["PUT"])
@require_admin
def update_spot(spot_id):
    """
    PUT /api/spots/:id – Update spot details.

    Updateable fields: spot_name, spot_type, is_active, is_occupied,
    is_reserved, floor_id.
    """
    data = request.get_json()
    updates = {}
    allowed = [
        "spot_name",
        "spot_type",
        "is_active",
        "is_occupied",
        "is_reserved",
        "floor_id",
    ]
    for field in allowed:
        if field in data:
            updates[field] = data[field]

    if not updates:
        return jsonify({"message": "No valid fields to update"}), 400

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    supabase.table("parking_spots").update(updates).eq("id", spot_id).execute()

    # If active status changed, re-sync facility total
    if "is_active" in updates:
        spot = (
            supabase.table("parking_spots")
            .select("facility_id")
            .eq("id", spot_id)
            .limit(1)
            .execute()
        )
        if spot.data:
            _sync_facility_total(spot.data[0]["facility_id"])

    return jsonify({"message": "Spot updated"}), 200


@app.route("/api/spots/<int:spot_id>", methods=["DELETE"])
@require_admin
def delete_spot(spot_id):
    """
    DELETE /api/spots/:id – Remove a parking spot.

    If the spot is currently occupied or has active reservations it
    cannot be deleted. Admins must free or reassign it first.
    """
    # Fetch the spot
    spot_result = (
        supabase.table("parking_spots")
        .select("*")
        .eq("id", spot_id)
        .limit(1)
        .execute()
    )
    if not spot_result.data:
        return jsonify({"message": "Spot not found"}), 404

    spot = spot_result.data[0]

    # Block deletion of occupied spots
    if spot.get("is_occupied"):
        return (
            jsonify(
                {"message": "Cannot delete an occupied spot. Free it first."}
            ),
            409,
        )

    # Block deletion if there's an active reservation on this spot
    active_res = (
        supabase.table("reservations")
        .select("id")
        .eq("spot_id", spot_id)
        .in_("status", ["pending", "confirmed", "checked_in"])
        .limit(1)
        .execute()
    )
    if active_res.data:
        return (
            jsonify(
                {
                    "message": "Cannot delete a spot with an active reservation. Cancel the reservation first."
                }
            ),
            409,
        )

    facility_id = spot["facility_id"]
    supabase.table("parking_spots").delete().eq("id", spot_id).execute()

    # Re-sync facility total
    _sync_facility_total(facility_id)

    return jsonify({"message": "Spot deleted"}), 200


@app.route(
    "/api/facilities/<int:facility_id>/spots/adjust-count", methods=["PUT"]
)
@require_admin
def adjust_spot_count(facility_id):
    """
    PUT /api/facilities/:id/spots/adjust-count
    Manually adjust the total slot count for a facility.

    Body: { "total": 50, "prefix"?: "A", "spot_type"?: "regular" }

    If the new total is higher, new spots are appended.
    If the new total is lower, unused (non-occupied, non-reserved) spots
    are deactivated from the end until the target is reached.
    """
    data = request.get_json() or {}
    new_total = data.get("total")
    if new_total is None or not isinstance(new_total, int) or new_total < 0:
        return jsonify({"message": "A valid 'total' (integer >= 0) is required"}), 400

    prefix = data.get("prefix", "A")
    spot_type = data.get("spot_type", "regular")

    # Current active spots
    current = (
        supabase.table("parking_spots")
        .select("*")
        .eq("facility_id", facility_id)
        .eq("is_active", True)
        .order("id")
        .execute()
    )
    current_count = len(current.data)

    if new_total > current_count:
        # Add spots
        to_add = new_total - current_count
        # Determine next number suffix
        max_num = 0
        for s in current.data:
            parts = s["spot_name"].rsplit("-", 1)
            if len(parts) == 2 and parts[1].isdigit():
                max_num = max(max_num, int(parts[1]))

        new_spots = []
        for i in range(1, to_add + 1):
            new_spots.append(
                {
                    "facility_id": facility_id,
                    "spot_name": f"{prefix}-{str(max_num + i).zfill(2)}",
                    "spot_type": spot_type,
                    "is_occupied": False,
                    "is_reserved": False,
                    "is_active": True,
                }
            )
        supabase.table("parking_spots").insert(new_spots).execute()

    elif new_total < current_count:
        # Deactivate unused spots from the end
        to_remove = current_count - new_total
        removable = [
            s
            for s in reversed(current.data)
            if not s["is_occupied"] and not s["is_reserved"]
        ]
        deactivated = 0
        for s in removable:
            if deactivated >= to_remove:
                break
            supabase.table("parking_spots").update(
                {"is_active": False}
            ).eq("id", s["id"]).execute()
            deactivated += 1

        if deactivated < to_remove:
            _sync_facility_total(facility_id)
            return (
                jsonify(
                    {
                        "message": f"Could only deactivate {deactivated} of {to_remove} spots (remaining are occupied/reserved)",
                        "deactivated": deactivated,
                    }
                ),
                200,
            )

    _sync_facility_total(facility_id)
    return (
        jsonify({"message": f"Facility now has {new_total} active spots"}),
        200,
    )


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------
def _sync_facility_total(facility_id):
    """Re-count active spots and update the facility's total_spots column."""
    active = (
        supabase.table("parking_spots")
        .select("id")
        .eq("facility_id", facility_id)
        .eq("is_active", True)
        .execute()
    )
    supabase.table("facilities").update(
        {
            "total_spots": len(active.data),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", facility_id).execute()
