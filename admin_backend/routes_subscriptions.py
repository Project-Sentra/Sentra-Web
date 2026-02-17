"""
routes_subscriptions.py - Subscription management
=================================================
Endpoints for monthly pass subscriptions.
"""

from datetime import datetime, timezone, timedelta
from flask import request, jsonify
from app import app, supabase
from routes_common import require_auth, _create_notification


# ==========================================================================
# 9. SUBSCRIPTIONS
# ==========================================================================


@app.route("/api/subscriptions", methods=["POST"])
@require_auth
def create_subscription():
    """
    POST /api/subscriptions
    Purchase a monthly pass.

    Body: { "facility_id", "vehicle_id", "plan_id" }
    """
    data = request.get_json()
    facility_id = data.get("facility_id")
    vehicle_id = data.get("vehicle_id")
    plan_id = data.get("plan_id")

    if not all([facility_id, vehicle_id, plan_id]):
        return (
            jsonify({"message": "facility_id, vehicle_id, and plan_id are required"}),
            400,
        )

    # Get plan details
    plan = (
        supabase.table("pricing_plans").select("*").eq("id", plan_id).limit(1).execute()
    )
    if not plan.data or plan.data[0]["plan_type"] != "monthly":
        return jsonify({"message": "Invalid monthly plan"}), 400

    amount = plan.data[0]["rate"]
    start_date = datetime.now(timezone.utc).date()
    end_date = start_date + timedelta(days=30)

    # Check wallet balance
    wallet = (
        supabase.table("user_wallets")
        .select("*")
        .eq("user_id", request.db_user["id"])
        .limit(1)
        .execute()
    )
    if not wallet.data or wallet.data[0]["balance"] < amount:
        return (
            jsonify({"message": f"Insufficient wallet balance. Need LKR {amount}"}),
            400,
        )

    # Deduct from wallet
    new_balance = wallet.data[0]["balance"] - amount
    supabase.table("user_wallets").update(
        {
            "balance": new_balance,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", wallet.data[0]["id"]).execute()

    # Create subscription
    sub = {
        "user_id": request.db_user["id"],
        "facility_id": facility_id,
        "vehicle_id": vehicle_id,
        "plan_id": plan_id,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "status": "active",
    }
    result = supabase.table("subscriptions").insert(sub).execute()

    # Record payment
    supabase.table("payments").insert(
        {
            "user_id": request.db_user["id"],
            "subscription_id": result.data[0]["id"],
            "amount": amount,
            "payment_method": "wallet",
            "payment_status": "completed",
            "description": f"Monthly pass: {plan.data[0]['name']}",
        }
    ).execute()

    _create_notification(
        request.db_user["id"],
        "Subscription Activated",
        f"Monthly pass active until {end_date.isoformat()}. Amount: LKR {amount}.",
        "subscription",
        {"subscription_id": result.data[0]["id"]},
    )

    return (
        jsonify({"message": "Subscription created", "subscription": result.data[0]}),
        201,
    )


@app.route("/api/subscriptions", methods=["GET"])
@require_auth
def get_subscriptions():
    """GET /api/subscriptions – Get user's subscriptions (or all for admin)."""
    if request.args.get("all") == "true" and request.db_user["role"] in (
        "admin",
        "operator",
    ):
        query = supabase.table("subscriptions").select(
            "*, users(email, full_name), vehicles(plate_number), facilities(name), pricing_plans(name, rate)"
        )
    else:
        query = (
            supabase.table("subscriptions")
            .select(
                "*, vehicles(plate_number), facilities(name), pricing_plans(name, rate)"
            )
            .eq("user_id", request.db_user["id"])
        )
    result = query.order("created_at", desc=True).execute()
    return jsonify({"subscriptions": result.data}), 200


@app.route("/api/subscriptions/<int:sub_id>", methods=["PUT"])
@require_auth
def update_subscription(sub_id):
    """PUT /api/subscriptions/:id – Cancel or update auto-renew."""
    data = request.get_json()
    updates = {}
    if data.get("action") == "cancel":
        updates["status"] = "cancelled"
    if "auto_renew" in data:
        updates["auto_renew"] = bool(data["auto_renew"])
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        supabase.table("subscriptions").update(updates).eq("id", sub_id).execute()
    return jsonify({"message": "Subscription updated"}), 200
