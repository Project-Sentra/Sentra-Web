"""
routes_auth.py - Auth endpoints
===============================
Signup, login, and profile management.
"""

from datetime import datetime, timezone

from flask import request, jsonify

from app import app, supabase
from routes_common import require_auth, require_token, get_json_body

# ==========================================================================
# 1. AUTH ENDPOINTS
# ==========================================================================


@app.route("/api/auth/signup", methods=["POST"])
def signup():
    """
    POST /api/auth/signup
    Register a new user account.

    Body: { "email", "password", "full_name"?, "phone"? }

    New accounts are ALWAYS created with role "user". Any "role" in the body
    is ignored. Admins/operators are promoted by an existing admin via
    PUT /api/admin/users/:id (the first admin is seeded with SQL).
    """
    data = get_json_body()
    email = data.get("email")
    password = data.get("password")
    full_name = data.get("full_name", "")
    phone = data.get("phone", "")
    role = "user"

    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400
    if len(password) < 6:
        return jsonify({"message": "Password must be at least 6 characters"}), 400

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
    data = get_json_body()
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
                .eq("auth_user_id", response.user.id)
                .limit(1)
                .execute()
            )
            user_record = user_data.data[0] if user_data.data else {}
            if user_record.get("is_active") is False:
                return jsonify({"message": "Account is deactivated"}), 403

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

    except Exception:
        return jsonify({"message": "Invalid email or password"}), 401


@app.route("/api/auth/me", methods=["GET"])
@require_auth
def get_profile():
    """GET /api/auth/me – Get current user's profile."""
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
                    "is_active": user.get("is_active", True),
                    "wallet_balance": wallet.data[0]["balance"] if wallet.data else 0,
                    "created_at": user.get("created_at"),
                }
            }
        ),
        200,
    )


@app.route("/api/auth/me", methods=["PUT"])
@require_auth
def update_profile():
    """PUT /api/auth/me – Update current user's profile."""
    data = get_json_body()
    updates = {}
    for field in ["full_name", "phone", "profile_image"]:
        if field in data:
            updates[field] = data[field]

    if not updates:
        return jsonify({"message": "No fields to update"}), 400

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    supabase.table("users").update(updates).eq("id", request.db_user["id"]).execute()

    return jsonify({"message": "Profile updated"}), 200


# ==========================================================================
# 2. SOCIAL / OAUTH LOGIN
# ==========================================================================


def _social_user_response(auth_user, user, message, status):
    """Same user shape as /api/auth/login so the frontend stores it identically."""
    return (
        jsonify(
            {
                "message": message,
                "user": {
                    "id": auth_user.id,
                    "db_id": user["id"],
                    "email": user["email"],
                    "full_name": user.get("full_name", ""),
                    "phone": user.get("phone", ""),
                    "role": user.get("role", "user"),
                },
            }
        ),
        status,
    )


def _find_user_by_email(email):
    result = supabase.table("users").select("*").eq("email", email).limit(1).execute()
    return result.data[0] if result.data else None


@app.route("/api/auth/social-login", methods=["POST"])
@require_token
def social_login():
    """
    POST /api/auth/social-login
    Called after OAuth (Google/Apple) to ensure a user record exists in the DB.
    First-time social users are created with role "user"; an admin must
    promote them before they can use the admin dashboard.

    The @require_token decorator validates the Supabase JWT and sets:
      - request.current_user  (Supabase auth user object)
      - request.db_user       (local DB record, or None if first login)

    A users row with the same email but no auth link (e.g. created by the
    mobile app) is linked to this account, but only when the provider has
    verified the email; otherwise anyone could claim an existing profile.
    """
    auth_user = request.current_user  # set by @require_token
    user = request.db_user

    if not user and auth_user.email:
        existing = _find_user_by_email(auth_user.email)
        if existing:
            if existing.get("auth_user_id"):
                return (
                    jsonify(
                        {
                            "message": "This email is already registered with "
                            "another sign-in method. Sign in with that method."
                        }
                    ),
                    409,
                )
            if not getattr(auth_user, "email_confirmed_at", None):
                return jsonify({"message": "Email address is not verified"}), 403
            linked = (
                supabase.table("users")
                .update({"auth_user_id": auth_user.id})
                .eq("id", existing["id"])
                .execute()
            )
            user = linked.data[0] if linked.data else existing

    if user:
        if user.get("is_active") is False:
            return jsonify({"message": "Account is deactivated"}), 403
        return _social_user_response(auth_user, user, "Login successful!", 200)

    # ── First-time social login: create the user record ──────────────
    user_meta = auth_user.user_metadata or {}
    full_name = (
        user_meta.get("full_name")
        or user_meta.get("name")
        or user_meta.get("preferred_username", "")
    )
    profile_image = user_meta.get("avatar_url") or user_meta.get("picture", "")

    try:
        result = (
            supabase.table("users")
            .insert(
                {
                    "email": auth_user.email,
                    "full_name": full_name,
                    "auth_user_id": auth_user.id,
                    "role": "user",  # never auto-grant admin
                    "profile_image": profile_image,
                }
            )
            .execute()
        )
    except Exception as e:
        # Race: a parallel request created the row between check and insert
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            existing = (
                supabase.table("users")
                .select("*")
                .eq("auth_user_id", auth_user.id)
                .limit(1)
                .execute()
            )
            if existing.data:
                return _social_user_response(
                    auth_user, existing.data[0], "Login successful!", 200
                )
        app.logger.exception("social-login: could not create user record")
        return jsonify({"message": "Could not create your account"}), 500

    if not result.data:
        return jsonify({"message": "Failed to create user record"}), 500

    new_user = result.data[0]
    supabase.table("user_wallets").insert(
        {"user_id": new_user["id"], "balance": 0}
    ).execute()

    return _social_user_response(auth_user, new_user, "Account created!", 201)
