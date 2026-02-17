"""
routes_wallet.py - Wallet and payments
======================================
Endpoints for wallet balance, top-ups, and payment history.
"""

from datetime import datetime, timezone
from flask import request, jsonify
from app import app, supabase
from routes_common import require_auth, DEFAULT_CURRENCY, _create_notification


# ==========================================================================
# 8. PAYMENTS & WALLET
# ==========================================================================


@app.route("/api/wallet", methods=["GET"])
@require_auth
def get_wallet():
    """GET /api/wallet – Get current user's wallet balance."""
    wallet = (
        supabase.table("user_wallets")
        .select("*")
        .eq("user_id", request.db_user["id"])
        .limit(1)
        .execute()
    )
    if not wallet.data:
        return jsonify({"balance": 0, "currency": DEFAULT_CURRENCY}), 200
    return jsonify(wallet.data[0]), 200


@app.route("/api/wallet/topup", methods=["POST"])
@require_auth
def topup_wallet():
    """
    POST /api/wallet/topup
    Add funds to wallet.

    Body: { "amount": 1000, "payment_method"?: "card"|"bank_transfer" }
    """
    data = request.get_json()
    amount = data.get("amount")
    if not amount or amount <= 0:
        return jsonify({"message": "A positive amount is required"}), 400

    wallet = (
        supabase.table("user_wallets")
        .select("*")
        .eq("user_id", request.db_user["id"])
        .limit(1)
        .execute()
    )
    if not wallet.data:
        return jsonify({"message": "Wallet not found"}), 404

    new_balance = wallet.data[0]["balance"] + amount
    supabase.table("user_wallets").update(
        {
            "balance": new_balance,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", wallet.data[0]["id"]).execute()

    # Record payment
    supabase.table("payments").insert(
        {
            "user_id": request.db_user["id"],
            "amount": amount,
            "payment_method": data.get("payment_method", "card"),
            "payment_status": "completed",
            "description": "Wallet top-up",
        }
    ).execute()

    _create_notification(
        request.db_user["id"],
        "Wallet Topped Up",
        f"LKR {amount} added to your wallet. New balance: LKR {new_balance}.",
        "payment",
        {"amount": amount, "new_balance": new_balance},
    )

    return jsonify({"message": "Wallet topped up", "new_balance": new_balance}), 200


@app.route("/api/payments", methods=["GET"])
@require_auth
def get_payments():
    """GET /api/payments – Payment history for the current user (or all for admin)."""
    if request.args.get("all") == "true" and request.db_user["role"] in (
        "admin",
        "operator",
    ):
        query = supabase.table("payments").select("*, users(email, full_name)")
    else:
        query = (
            supabase.table("payments").select("*").eq("user_id", request.db_user["id"])
        )

    result = query.order("created_at", desc=True).limit(100).execute()
    return jsonify({"payments": result.data}), 200
