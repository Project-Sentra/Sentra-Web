"""
routes_facilities.py - Facility management
==========================================
CRUD for parking facilities.
"""

from datetime import datetime, timezone
from flask import request, jsonify
from app import app, supabase
from routes_common import require_admin, DEFAULT_HOURLY_RATE

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
        reserved = sum(
            1 for s in spots.data if s["is_reserved"] and not s["is_occupied"]
        )

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
    facility = (
        supabase.table("facilities")
        .select("*")
        .eq("id", facility_id)
        .limit(1)
        .execute()
    )
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

    return (
        jsonify(
            {
                "facility": facility.data[0],
                "floors": floors.data,
                "summary": {
                    "total": total,
                    "occupied": occupied,
                    "reserved": reserved,
                    "available": total - occupied - reserved,
                },
            }
        ),
        200,
    )


@app.route("/api/facilities/<int:facility_id>", methods=["PUT"])
@require_admin
def update_facility(facility_id):
    """PUT /api/facilities/:id – Update facility details."""
    data = request.get_json()
    updates = {}
    for field in [
        "name",
        "address",
        "city",
        "latitude",
        "longitude",
        "hourly_rate",
        "operating_hours_start",
        "operating_hours_end",
        "is_active",
        "image_url",
    ]:
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
