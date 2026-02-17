"""
routes_reservations.py - Reservation management
===============================================
Endpoints for booking and managing reservations.
"""

from datetime import datetime, timezone
import uuid
from flask import request, jsonify
from app import app, supabase
from routes_common import require_auth, _create_notification


# ==========================================================================
# 6. RESERVATIONS
# ==========================================================================


@app.route("/api/reservations", methods=["POST"])
@require_auth
def create_reservation():
    """
    POST /api/reservations
    Book a parking spot in advance.

    Body: { "vehicle_id", "facility_id", "reserved_start", "reserved_end", "spot_type"?: "regular" }
    """
    data = request.get_json()
    vehicle_id = data.get("vehicle_id")
    facility_id = data.get("facility_id")
    start = data.get("reserved_start")
    end = data.get("reserved_end")
    spot_type = data.get("spot_type", "regular")

    if not all([vehicle_id, facility_id, start, end]):
        return (
            jsonify(
                {
                    "message": "vehicle_id, facility_id, reserved_start, and reserved_end are required"
                }
            ),
            400,
        )

    # Find an available spot of the requested type
    spots = (
        supabase.table("parking_spots")
        .select("*")
        .eq("facility_id", facility_id)
        .eq("is_occupied", False)
        .eq("is_reserved", False)
        .eq("is_active", True)
        .eq("spot_type", spot_type)
        .order("id")
        .limit(1)
        .execute()
    )

    if not spots.data:
        return jsonify({"message": "No available spots of this type"}), 404

    spot = spots.data[0]

    # Get reservation pricing
    pricing = (
        supabase.table("pricing_plans")
        .select("rate")
        .eq("facility_id", facility_id)
        .eq("plan_type", "reservation")
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    amount = pricing.data[0]["rate"] if pricing.data else 200  # Default LKR 200

    # Mark spot as reserved
    supabase.table("parking_spots").update({"is_reserved": True}).eq(
        "id", spot["id"]
    ).execute()

    # Create reservation
    reservation = {
        "user_id": request.db_user["id"],
        "vehicle_id": vehicle_id,
        "facility_id": facility_id,
        "spot_id": spot["id"],
        "reserved_start": start,
        "reserved_end": end,
        "status": "confirmed",
        "amount": amount,
        "payment_status": "pending",
        "qr_code": str(uuid.uuid4()),
    }
    result = supabase.table("reservations").insert(reservation).execute()

    # Notify user
    _create_notification(
        request.db_user["id"],
        "Reservation Confirmed",
        f"Your spot {spot['spot_name']} is reserved. Show QR code at entry.",
        "reservation",
        {"reservation_id": result.data[0]["id"], "spot_name": spot["spot_name"]},
    )

    return (
        jsonify({"message": "Reservation confirmed", "reservation": result.data[0]}),
        201,
    )


@app.route("/api/reservations", methods=["GET"])
@require_auth
def get_reservations():
    """
    GET /api/reservations
    - Users: their reservations
    - Admin: all reservations (with ?all=true)
    """
    if request.args.get("all") == "true" and request.db_user["role"] in (
        "admin",
        "operator",
    ):
        query = (
            supabase.table("reservations")
            .select(
                "*, users(email, full_name), vehicles(plate_number), facilities(name), parking_spots(spot_name)"
            )
            .order("reserved_start", desc=True)
        )
    else:
        query = (
            supabase.table("reservations")
            .select(
                "*, vehicles(plate_number), facilities(name), parking_spots(spot_name)"
            )
            .eq("user_id", request.db_user["id"])
            .order("reserved_start", desc=True)
        )

    status_filter = request.args.get("status")
    if status_filter:
        query = query.eq("status", status_filter)

    result = query.limit(100).execute()
    return jsonify({"reservations": result.data}), 200


@app.route("/api/reservations/<int:reservation_id>", methods=["PUT"])
@require_auth
def update_reservation(reservation_id):
    """PUT /api/reservations/:id – Update or cancel a reservation."""
    data = request.get_json()
    action = data.get("action")

    if action == "cancel":
        # Free the reserved spot
        res = (
            supabase.table("reservations")
            .select("spot_id, user_id")
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        )
        if res.data:
            if res.data[0]["spot_id"]:
                supabase.table("parking_spots").update({"is_reserved": False}).eq(
                    "id", res.data[0]["spot_id"]
                ).execute()

            supabase.table("reservations").update(
                {
                    "status": "cancelled",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", reservation_id).execute()

            _create_notification(
                res.data[0]["user_id"],
                "Reservation Cancelled",
                "Your parking reservation has been cancelled.",
                "reservation",
                {"reservation_id": reservation_id},
            )

        return jsonify({"message": "Reservation cancelled"}), 200

    # General update (time changes, etc.)
    updates = {}
    for field in ["reserved_start", "reserved_end", "notes"]:
        if field in data:
            updates[field] = data[field]
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        supabase.table("reservations").update(updates).eq(
            "id", reservation_id
        ).execute()

    return jsonify({"message": "Reservation updated"}), 200
