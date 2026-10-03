"""
routes_wallet.py - Wallet and payments
======================================
Endpoints for wallet balance, top-ups, and payment history.
"""

from datetime import datetime, timezone
import os
import stripe
from flask import request, jsonify
from app import app, supabase
from routes_common import (
    require_auth,
    get_json_body,
    is_admin_user,
    DEFAULT_CURRENCY,
    _create_notification,
)

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# ==========================================================================
# 8. PAYMENTS & WALLET
# ==========================================================================


@app.route("/api/payments/create-intent", methods=["POST"])
@require_auth
def create_payment_intent():
    """
    POST /api/payments/create-intent
    Create a Stripe PaymentIntent for wallet top-up or direct payment.
    """
    if not stripe.api_key:
        return jsonify({"message": "Stripe is not configured on the server"}), 503

    data = get_json_body()
    amount = data.get("amount")
    currency = str(data.get("currency", "lkr")).lower()

    if (
        isinstance(amount, bool)
        or not isinstance(amount, (int, float))
        or amount <= 0
        or amount > 1_000_000
    ):
        return (
            jsonify({"message": "A positive amount (max 1,000,000) is required"}),
            400,
        )

    try:
        # Create a PaymentIntent with the order amount and currency
        intent = stripe.PaymentIntent.create(
            amount=int(
                amount * 100
            ),  # Stripe expects amounts in cents/cents-equivalent
            currency=currency,
            metadata={"user_id": request.db_user["id"], "type": "wallet_topup"},
        )
        return (
            jsonify(
                {"clientSecret": intent.client_secret, "paymentIntentId": intent.id}
            ),
            200,
        )
    except Exception as e:
        return jsonify({"message": str(e)}), 400


@app.route("/api/wallet/confirm-topup", methods=["POST"])
@require_auth
def confirm_topup():
    """
    POST /api/wallet/confirm-topup
    Verify a Stripe PaymentIntent and update wallet balance.
    """
    data = get_json_body()
    payment_intent_id = data.get("payment_intent_id")

    if not payment_intent_id:
        return jsonify({"message": "payment_intent_id is required"}), 400

    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        if intent.status != "succeeded":
            return jsonify({"message": f"Payment not successful: {intent.status}"}), 400

        # The intent must have been created for THIS user as a wallet top-up
        metadata = intent.metadata or {}
        if (
            str(metadata.get("user_id")) != str(request.db_user["id"])
            or metadata.get("type") != "wallet_topup"
        ):
            return jsonify({"message": "Payment does not belong to this account"}), 403

        # Check if this payment was already processed to prevent double-crediting
        existing_payment = (
            supabase.table("payments")
            .select("id")
            .eq("transaction_ref", payment_intent_id)
            .execute()
        )
        if existing_payment.data:
            return jsonify({"message": "Payment already processed"}), 400

        amount = intent.amount / 100  # Convert back from cents

        # Update wallet
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
                "payment_method": "card",
                "payment_status": "completed",
                "description": "Stripe Wallet Top-up",
                "transaction_ref": payment_intent_id,
            }
        ).execute()

        _create_notification(
            request.db_user["id"],
            "Wallet Topped Up",
            f"LKR {amount} added to your wallet via Card. New balance: LKR {new_balance}.",
            "payment",
            {"amount": amount, "new_balance": new_balance},
        )

        return (
            jsonify(
                {"message": "Wallet topped up successfully", "new_balance": new_balance}
            ),
            200,
        )

    except Exception as e:
        return jsonify({"message": str(e)}), 400


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


# NOTE: The old POST /api/wallet/topup endpoint (which credited the wallet
# without any payment) has been removed. Top-ups must go through
# /api/payments/create-intent → Stripe → /api/wallet/confirm-topup.


@app.route("/api/payments", methods=["GET"])
@require_auth
def get_payments():
    """GET /api/payments – Payment history for the current user (or all for admin)."""
    if request.args.get("all") == "true" and is_admin_user(request.db_user):
        query = supabase.table("payments").select("*, users(email, full_name)")
    else:
        query = (
            supabase.table("payments").select("*").eq("user_id", request.db_user["id"])
        )

    result = query.order("created_at", desc=True).limit(100).execute()
    return jsonify({"payments": result.data}), 200
