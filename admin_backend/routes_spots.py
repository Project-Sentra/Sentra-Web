"""
routes_spots.py - Parking spot management
=========================================
Endpoints for listing and initializing parking spots.
"""

from flask import request, jsonify
from app import app, supabase
from routes_common import require_admin

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
