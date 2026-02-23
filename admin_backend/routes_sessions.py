"""
routes_sessions.py - Parking session management
================================================
Entry, exit, and session history endpoints.
"""

from datetime import datetime, timezone
from math import ceil
from flask import request, jsonify
from app import app, supabase
from routes_common import require_auth, DEFAULT_HOURLY_RATE, _create_notification

# ==========================================================================
# 7. PARKING SESSIONS (Entry / Exit)
# ==========================================================================


@app.route("/api/sessions/entry", methods=["POST"])
def vehicle_entry():
    """
    POST /api/sessions/entry
    Register a vehicle entering a facility.

    Body: { "plate_number", "facility_id", "entry_method"?: "lpr"|"manual"|"qr_code" }

    Three scenarios:
      Scenario 1 – Registered user WITH pre-reservation:
        LPR reads plate → reservation found → reserved spot used → gate opens.
        Billing starts from the *scheduled reservation time* (reserved_start).

      Scenario 2 – Registered user WITHOUT reservation:
        LPR reads plate → active registration found → system auto-assigns
        an available spot → gate opens → push notification sent to user
        with assigned spot info. Billing starts at moment of entry.

      Scenario 3 – Unregistered / new user:
        LPR reads plate → no matching registration → gate stays CLOSED.
        Response instructs kiosk / display to show QR code for registration.
        Once registered, vehicle follows Scenario 2 on next attempt.

    This endpoint is PUBLIC so the LPR service can call it.
    """
    data = request.get_json()
    plate = data.get("plate_number")
    facility_id = data.get("facility_id")
    entry_method = data.get("entry_method", "lpr")

    if not plate:
        return jsonify({"message": "plate_number is required"}), 400
    if not facility_id:
        return jsonify({"message": "facility_id is required"}), 400

    # Check for duplicate active session
    active = (
        supabase.table("parking_sessions")
        .select("*")
        .eq("plate_number", plate)
        .is_("exit_time", "null")
        .limit(1)
        .execute()
    )
    if active.data:
        return (
            jsonify(
                {
                    "message": f"Vehicle {plate} is already parked at {active.data[0]['spot_name']}",
                    "gate_action": "deny",
                }
            ),
            409,
        )

    # Look up vehicle registration
    vehicle = (
        supabase.table("vehicles")
        .select("*, users(id, full_name)")
        .eq("plate_number", plate)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    vehicle_data = vehicle.data[0] if vehicle.data else None
    vehicle_id = vehicle_data["id"] if vehicle_data else None
    user_id = vehicle_data["user_id"] if vehicle_data else None
    is_registered = vehicle_data is not None

    # ── Scenario 3: Unregistered vehicle → deny entry ──────────────
    if not is_registered:
        # Log the detection so the admin can see it
        try:
            supabase.table("detection_logs").insert(
                {
                    "facility_id": facility_id,
                    "plate_number": plate,
                    "is_registered": False,
                    "action_taken": "denied",
                }
            ).execute()
        except Exception:
            pass

        return (
            jsonify(
                {
                    "message": (
                        f"Vehicle {plate} is not registered. "
                        "Please scan the QR code at the kiosk to register via the Sentra app."
                    ),
                    "is_registered": False,
                    "gate_action": "deny",
                    "requires_registration": True,
                }
            ),
            403,
        )

    session_type = "walk_in"
    reservation_id = None
    spot = None
    billing_start = datetime.now(timezone.utc)  # default: now

    # ── Scenario 1: Check for active reservation ───────────────────
    if vehicle_id:
        res = (
            supabase.table("reservations")
            .select("*, parking_spots(id, spot_name)")
            .eq("vehicle_id", vehicle_id)
            .eq("facility_id", facility_id)
            .eq("status", "confirmed")
            .limit(1)
            .execute()
        )
        if res.data:
            reservation = res.data[0]
            reservation_id = reservation["id"]
            session_type = "reserved"

            # Billing starts from the scheduled reservation time
            reserved_start_str = reservation.get("reserved_start")
            if reserved_start_str:
                try:
                    billing_start = datetime.fromisoformat(
                        reserved_start_str.replace("Z", "+00:00")
                    )
                except (ValueError, TypeError):
                    pass  # fallback to now

            # Use the reserved spot
            if reservation.get("spot_id"):
                spot_result = (
                    supabase.table("parking_spots")
                    .select("*")
                    .eq("id", reservation["spot_id"])
                    .limit(1)
                    .execute()
                )
                spot = spot_result.data[0] if spot_result.data else None

            # Update reservation status
            supabase.table("reservations").update(
                {
                    "status": "checked_in",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", reservation_id).execute()

    # Check for active subscription
    if vehicle_id and session_type == "walk_in":
        sub = (
            supabase.table("subscriptions")
            .select("*")
            .eq("vehicle_id", vehicle_id)
            .eq("facility_id", facility_id)
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        if sub.data:
            session_type = "subscription"

    # ── Scenario 2: auto-assign a free spot (walk-in / subscription) ─
    if not spot:
        spot_result = (
            supabase.table("parking_spots")
            .select("*")
            .eq("facility_id", facility_id)
            .eq("is_occupied", False)
            .eq("is_reserved", False)
            .eq("is_active", True)
            .order("id")
            .limit(1)
            .execute()
        )
        if not spot_result.data:
            return jsonify({"message": "Parking is full!", "gate_action": "deny"}), 404
        spot = spot_result.data[0]

    # Mark spot as occupied, clear reserved flag
    supabase.table("parking_spots").update(
        {
            "is_occupied": True,
            "is_reserved": False,
        }
    ).eq("id", spot["id"]).execute()

    # Create parking session (entry_time = billing start)
    session = {
        "vehicle_id": vehicle_id,
        "facility_id": facility_id,
        "spot_id": spot["id"],
        "reservation_id": reservation_id,
        "plate_number": plate,
        "spot_name": spot["spot_name"],
        "entry_time": billing_start.isoformat(),
        "session_type": session_type,
        "entry_method": entry_method,
    }
    session_result = supabase.table("parking_sessions").insert(session).execute()

    # Notify registered user (push notification with assigned spot)
    if user_id:
        if session_type == "reserved":
            notif_title = "Reservation Checked In"
            notif_msg = (
                f"Welcome! Your reserved spot {spot['spot_name']} is ready. "
                f"Vehicle: {plate}."
            )
        else:
            notif_title = "Spot Assigned"
            notif_msg = (
                f"Your vehicle {plate} has been assigned to spot {spot['spot_name']}. "
                "Please proceed to your assigned spot."
            )

        _create_notification(
            user_id,
            notif_title,
            notif_msg,
            "entry",
            {
                "session_id": session_result.data[0]["id"],
                "spot_name": spot["spot_name"],
                "facility_id": facility_id,
            },
        )

    # Gate always opens for registered vehicles
    gate_action = "open"

    return (
        jsonify(
            {
                "message": f"Vehicle {plate} parked at {spot['spot_name']}",
                "spot": spot["spot_name"],
                "session_type": session_type,
                "is_registered": is_registered,
                "gate_action": gate_action,
                "session_id": session_result.data[0]["id"],
            }
        ),
        200,
    )


@app.route("/api/sessions/exit", methods=["POST"])
def vehicle_exit():
    """
    POST /api/sessions/exit
    Process a vehicle exiting a facility.

    Body: { "plate_number", "payment_method"?: "wallet"|"cash"|"card" }

    Flow:
      1. Find active session for this plate
      2. Free the parking spot
      3. Calculate fee (skip if subscription)
      4. Process payment (wallet auto-deduct, or mark as pending)
      5. Close session, notify user
    """
    data = request.get_json() or {}
    plate = data.get("plate_number")
    payment_method = data.get("payment_method", "wallet")

    if not plate:
        return jsonify({"message": "plate_number is required"}), 400

    # Find active session
    session_result = (
        supabase.table("parking_sessions")
        .select("*")
        .eq("plate_number", plate)
        .is_("exit_time", "null")
        .order("entry_time", desc=True)
        .limit(1)
        .execute()
    )
    if not session_result.data:
        return jsonify({"message": f"No active session for {plate}"}), 404

    session = session_result.data[0]

    # Free the spot
    if session.get("spot_id"):
        supabase.table("parking_spots").update(
            {
                "is_occupied": False,
                "is_reserved": False,
            }
        ).eq("id", session["spot_id"]).execute()

    # Calculate duration and fee
    entry_time = datetime.fromisoformat(session["entry_time"].replace("Z", "+00:00"))
    exit_time = datetime.now(timezone.utc)
    duration_minutes = int((exit_time - entry_time).total_seconds() // 60)

    # Get facility rate
    facility = (
        supabase.table("facilities")
        .select("hourly_rate")
        .eq("id", session["facility_id"])
        .limit(1)
        .execute()
    )
    rate = facility.data[0]["hourly_rate"] if facility.data else DEFAULT_HOURLY_RATE

    # Calculate amount
    if session["session_type"] == "subscription":
        amount = 0
        payment_status = "waived"
    else:
        billed_hours = max(1, ceil(duration_minutes / 60))
        amount = billed_hours * rate
        payment_status = "pending"

    # Update session
    supabase.table("parking_sessions").update(
        {
            "exit_time": exit_time.isoformat(),
            "duration_minutes": duration_minutes,
            "amount": amount,
            "payment_status": payment_status if amount == 0 else "pending",
        }
    ).eq("id", session["id"]).execute()

    # Complete reservation if applicable
    if session.get("reservation_id"):
        supabase.table("reservations").update(
            {
                "status": "completed",
                "updated_at": exit_time.isoformat(),
            }
        ).eq("id", session["reservation_id"]).execute()

    # Auto-pay from wallet if registered user
    if amount > 0 and session.get("vehicle_id"):
        vehicle = (
            supabase.table("vehicles")
            .select("user_id")
            .eq("id", session["vehicle_id"])
            .limit(1)
            .execute()
        )
        if vehicle.data:
            user_id = vehicle.data[0]["user_id"]
            wallet = (
                supabase.table("user_wallets")
                .select("*")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if (
                wallet.data
                and wallet.data[0]["balance"] >= amount
                and payment_method == "wallet"
            ):
                new_balance = wallet.data[0]["balance"] - amount
                supabase.table("user_wallets").update(
                    {
                        "balance": new_balance,
                        "updated_at": exit_time.isoformat(),
                    }
                ).eq("id", wallet.data[0]["id"]).execute()

                supabase.table("payments").insert(
                    {
                        "user_id": user_id,
                        "session_id": session["id"],
                        "amount": amount,
                        "payment_method": "wallet",
                        "payment_status": "completed",
                        "description": f"Parking fee for {plate} at {session['spot_name']}",
                    }
                ).execute()

                supabase.table("parking_sessions").update(
                    {
                        "payment_status": "paid",
                    }
                ).eq("id", session["id"]).execute()

                payment_status = "paid"

            # Notify user
            _create_notification(
                user_id,
                "Vehicle Exited",
                f"Your vehicle {plate} has left. Duration: {duration_minutes} min. Fee: LKR {amount}.",
                "exit",
                {
                    "session_id": session["id"],
                    "amount": amount,
                    "duration_minutes": duration_minutes,
                },
            )

    return (
        jsonify(
            {
                "message": f"Spot {session['spot_name']} is now free!",
                "duration_minutes": duration_minutes,
                "amount": amount,
                "payment_status": payment_status,
                "gate_action": "open",
            }
        ),
        200,
    )


@app.route("/api/sessions", methods=["GET"])
@require_auth
def get_sessions():
    """
    GET /api/sessions
    Get parking session history.

    Query params: ?facility_id=1&active=true&limit=50
    - Users: their sessions only
    - Admin: all sessions (with ?all=true)
    """
    limit = request.args.get("limit", 50, type=int)
    facility_id = request.args.get("facility_id", type=int)
    active_only = request.args.get("active") == "true"

    if request.args.get("all") == "true" and request.db_user["role"] in (
        "admin",
        "operator",
    ):
        query = supabase.table("parking_sessions").select("*")
    elif request.db_user.get("id"):
        # Get user's vehicle IDs
        vehicles = (
            supabase.table("vehicles")
            .select("id")
            .eq("user_id", request.db_user["id"])
            .execute()
        )
        vehicle_ids = [v["id"] for v in vehicles.data]
        if not vehicle_ids:
            return jsonify({"sessions": []}), 200
        query = (
            supabase.table("parking_sessions")
            .select("*")
            .in_("vehicle_id", vehicle_ids)
        )
    else:
        return jsonify({"sessions": []}), 200

    if facility_id:
        query = query.eq("facility_id", facility_id)
    if active_only:
        query = query.is_("exit_time", "null")

    result = query.order("entry_time", desc=True).limit(limit).execute()
    return jsonify({"sessions": result.data}), 200
