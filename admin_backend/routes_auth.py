"""
routes_auth.py - Auth endpoints
===============================
Signup, login, and profile management.
"""

from datetime import datetime, timezone

from flask import request, jsonify

from app import app, supabase
from routes_common import require_auth


# ==========================================================================
# 1. AUTH ENDPOINTS
# ==========================================================================


@app.route("/api/auth/signup", methods=["POST"])
def signup():
    """
    POST /api/auth/signup
    Register a new user (admin or mobile app user).

    Body: { "email", "password", "full_name"?, "phone"?, "role"?: "user"|"admin" }
    """
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    full_name = data.get("full_name", "")
    phone = data.get("phone", "")
    role = data.get("role", "user")  # Default = mobile app user

    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400
    if len(password) < 6:
        return jsonify({"message": "Password must be at least 6 characters"}), 400
    if role not in ("admin", "user", "operator"):
        return jsonify({"message": "role must be admin, user, or operator"}), 400

    try:
        response = supabase.auth.sign_up(
            {
                "email": email,
                "password": password,
                "options": {"data": {"role": role, "full_name": full_name}},
            }
        )

        if response.user:
            # Create local user record
            user_record = {
                "email": email,
                "full_name": full_name,
                "phone": phone,
                "role": role,
                "auth_user_id": response.user.id,
            }
            result = supabase.table("users").insert(user_record).execute()

            # Create wallet for the user
            if result.data:
                supabase.table("user_wallets").insert(
                    {
                        "user_id": result.data[0]["id"],
                        "balance": 0,
                    }
                ).execute()

            return (
                jsonify(
                    {
                        "message": "Account created! Please check your email to verify.",
                        "user_id": response.user.id,
                    }
                ),
                201,
            )
        else:
            return jsonify({"message": "Failed to create account"}), 400

    except Exception as e:
        error_msg = str(e)
        if "already registered" in error_msg.lower():
            return (
                jsonify({"message": "An account with this email already exists"}),
                400,
            )
        return jsonify({"message": f"Error: {error_msg}"}), 500


@app.route("/api/auth/login", methods=["POST"])
def login():
    """
    POST /api/auth/login
    Authenticate and return JWT tokens + user info.

    Body: { "email", "password" }
    """
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400

    try:
        response = supabase.auth.sign_in_with_password(
            {
                "email": email,
                "password": password,
            }
        )

        if response.user and response.session:
            user_data = (
                supabase.table("users")
                .select("*")
                .eq("email", email)
                .limit(1)
                .execute()
            )
            user_record = user_data.data[0] if user_data.data else {}

            return (
                jsonify(
                    {
                        "message": "Login successful!",
                        "access_token": response.session.access_token,
                        "refresh_token": response.session.refresh_token,
                        "user": {
                            "id": response.user.id,
                            "db_id": user_record.get("id"),
                            "email": response.user.email,
                            "full_name": user_record.get("full_name", ""),
                            "phone": user_record.get("phone", ""),
                            "role": user_record.get("role", "user"),
                        },
                    }
                ),
                200,
            )
        else:
            return jsonify({"message": "Invalid email or password"}), 401

    except Exception as e:
        return jsonify({"message": f"Login failed: {str(e)}"}), 401


@app.route("/api/auth/me", methods=["GET"])
@require_auth
def get_profile():
    """GET /api/auth/me – Get current user's profile."""
    if not request.db_user:
        return jsonify({"message": "User profile not found"}), 404

    user = request.db_user
    # Get wallet balance
    wallet = (
        supabase.table("user_wallets")
        .select("balance")
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )

    return (
        jsonify(
            {
                "user": {
                    "id": user["id"],
                    "email": user["email"],
                    "full_name": user.get("full_name"),
                    "phone": user.get("phone"),
                    "role": user["role"],
                    "is_active": user["is_active"],
                    "wallet_balance": wallet.data[0]["balance"] if wallet.data else 0,
                    "created_at": user["created_at"],
                }
            }
        ),
        200,
    )


@app.route("/api/auth/me", methods=["PUT"])
@require_auth
def update_profile():
    """PUT /api/auth/me – Update current user's profile."""
    data = request.get_json()
    updates = {}
    for field in ["full_name", "phone", "profile_image"]:
        if field in data:
            updates[field] = data[field]

    if not updates:
        return jsonify({"message": "No fields to update"}), 400

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    supabase.table("users").update(updates).eq("id", request.db_user["id"]).execute()

    return jsonify({"message": "Profile updated"}), 200
