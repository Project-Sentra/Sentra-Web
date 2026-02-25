"""
routes_reservations.py - Reservation management
===============================================
Endpoints for booking and managing reservations.
"""

from datetime import datetime, timezone
import uuid
from flask import request, jsonify
from app import app, supabase
from routes_common import require_auth, require_admin, _create_notification

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
    - Admin: all reservations (with ?all=true), filterable by status and facility_id
    """
    is_admin = request.args.get("all") == "true" and request.db_user["role"] in (
        "admin",
        "operator",
    )

    if is_admin:
        query = (
            supabase.table("reservations")
            .select(
                "*, users(id, email, full_name, phone), vehicles(plate_number, make, model), "
                "facilities(name), parking_spots(spot_name, spot_type)"
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

    facility_filter = request.args.get("facility_id")
    if facility_filter:
        query = query.eq("facility_id", int(facility_filter))

    result = query.limit(200).execute()
    return jsonify({"reservations": result.data}), 200


@app.route("/api/reservations/<int:reservation_id>", methods=["GET"])
@require_auth
def get_reservation_detail(reservation_id):
    """GET /api/reservations/:id – Get full reservation detail (admin)."""
    res = (
        supabase.table("reservations")
        .select(
            "*, users(id, email, full_name, phone), vehicles(plate_number, make, model), "
            "facilities(name, address, hourly_rate), parking_spots(spot_name, spot_type, floor_id)"
        )
        .eq("id", reservation_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        return jsonify({"message": "Reservation not found"}), 404
    return jsonify({"reservation": res.data[0]}), 200


@app.route("/api/reservations/<int:reservation_id>", methods=["PUT"])
@require_auth
def update_reservation(reservation_id):
    """
    PUT /api/reservations/:id – Perform admin actions on a reservation.

    Body: { "action": "cancel" | "confirm" | "check_in" | "complete" | "no_show" }
      or  { "reserved_start", "reserved_end", "notes", "amount" } for general edits.
    """
    data = request.get_json()
    action = data.get("action")
    now_iso = datetime.now(timezone.utc).isoformat()

    # Fetch reservation
    res = (
        supabase.table("reservations")
        .select("*")
        .eq("id", reservation_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        return jsonify({"message": "Reservation not found"}), 404

    reservation = res.data[0]

    # ---------- ACTION: cancel ----------
    if action == "cancel":
        if reservation["spot_id"]:
            supabase.table("parking_spots").update({"is_reserved": False}).eq(
                "id", reservation["spot_id"]
            ).execute()

        supabase.table("reservations").update(
            {"status": "cancelled", "updated_at": now_iso}
        ).eq("id", reservation_id).execute()

        _create_notification(
            reservation["user_id"],
            "Reservation Cancelled",
            "Your parking reservation has been cancelled by the administrator.",
            "reservation",
            {"reservation_id": reservation_id},
        )
        return jsonify({"message": "Reservation cancelled"}), 200

    # ---------- ACTION: confirm ----------
    if action == "confirm":
        if reservation["status"] not in ("pending",):
            return jsonify({"message": f"Cannot confirm a {reservation['status']} reservation"}), 400
        supabase.table("reservations").update(
            {"status": "confirmed", "updated_at": now_iso}
        ).eq("id", reservation_id).execute()

        _create_notification(
            reservation["user_id"],
            "Reservation Confirmed",
            "Your parking reservation has been confirmed by the administrator.",
            "reservation",
            {"reservation_id": reservation_id},
        )
        return jsonify({"message": "Reservation confirmed"}), 200

    # ---------- ACTION: check_in ----------
    if action == "check_in":
        if reservation["status"] not in ("confirmed", "pending"):
            return jsonify({"message": f"Cannot check in a {reservation['status']} reservation"}), 400
        supabase.table("reservations").update(
            {"status": "checked_in", "updated_at": now_iso}
        ).eq("id", reservation_id).execute()
        return jsonify({"message": "Reservation checked in"}), 200

    # ---------- ACTION: complete ----------
    if action == "complete":
        if reservation["status"] not in ("checked_in", "confirmed"):
            return jsonify({"message": f"Cannot complete a {reservation['status']} reservation"}), 400

        # Free the spot
        if reservation["spot_id"]:
            supabase.table("parking_spots").update(
                {"is_reserved": False, "is_occupied": False}
            ).eq("id", reservation["spot_id"]).execute()

        supabase.table("reservations").update(
            {"status": "completed", "payment_status": "paid", "updated_at": now_iso}
        ).eq("id", reservation_id).execute()

        _create_notification(
            reservation["user_id"],
            "Reservation Completed",
            "Your parking session has been completed. Thank you!",
            "reservation",
            {"reservation_id": reservation_id},
        )
        return jsonify({"message": "Reservation completed"}), 200

    # ---------- ACTION: no_show ----------
    if action == "no_show":
        if reservation["status"] not in ("confirmed", "pending"):
            return jsonify({"message": f"Cannot mark a {reservation['status']} reservation as no-show"}), 400

        # Free the spot
        if reservation["spot_id"]:
            supabase.table("parking_spots").update({"is_reserved": False}).eq(
                "id", reservation["spot_id"]
            ).execute()

        supabase.table("reservations").update(
            {"status": "no_show", "updated_at": now_iso}
        ).eq("id", reservation_id).execute()

        _create_notification(
            reservation["user_id"],
            "Reservation No-Show",
            "You did not show up for your reservation. The spot has been released.",
            "reservation",
            {"reservation_id": reservation_id},
        )
        return jsonify({"message": "Reservation marked as no-show"}), 200

    # ---------- General update (no action) ----------
    updates = {}
    for field in ["reserved_start", "reserved_end", "notes", "amount", "payment_status"]:
        if field in data:
            updates[field] = data[field]
    if updates:
        updates["updated_at"] = now_iso
        supabase.table("reservations").update(updates).eq(
            "id", reservation_id
        ).execute()

    return jsonify({"message": "Reservation updated"}), 200
