"""
routes_common.py - Shared constants and auth helpers
====================================================
Centralizes shared constants, auth decorators, and small helpers used
across the route modules.

Auth decorators:
  require_token            - valid Supabase JWT; the local user profile may be missing
                             (only used by /api/auth/social-login to create it)
  require_auth             - valid JWT AND an active local user profile
  require_admin            - require_auth + role admin/operator
  require_service_or_admin - the SentraAI service (X-Service-Key header) OR an admin JWT
"""

import hmac
import os
import re
from functools import wraps

from flask import request, jsonify

from app import supabase

# External LPR service URL (use container name in Docker, localhost for local dev)
LPR_SERVICE_URL = os.getenv("LPR_SERVICE_URL", "http://127.0.0.1:5001")

# Shared secret the SentraAI service sends in the X-Service-Key header.
# If unset, service-key auth is disabled and only admin JWTs are accepted.
SERVICE_API_KEY = os.getenv("SERVICE_API_KEY", "")

# Defaults
DEFAULT_HOURLY_RATE = 150  # LKR per hour (fallback when facility has no rate)
DEFAULT_CURRENCY = "LKR"

ADMIN_ROLES = ("admin", "operator")


def normalize_plate(plate):
    """Canonical plate key: uppercase, letters/digits only.
    "CAG 5124", "cag-5124", "CAG5124" → "CAG5124". The LPR service, mobile app
    and admin all format plates differently, so every write and lookup uses this.
    Mirrors the normalize_plate_number() DB trigger (normalize_plates.sql)."""
    return re.sub(r"[^A-Z0-9]", "", (plate or "").upper())


def get_json_body():
    """Return the request JSON body as a dict ({} if missing or not an object)."""
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def is_admin_user(db_user):
    """True if the local user record has an admin/operator role."""
    return bool(db_user) and db_user.get("role") in ADMIN_ROLES


def _authenticate():
    """
    Validate the Bearer token and load the local user record.

    Returns (auth_user, db_user, None) on success, or
    (None, None, (response, status)) on failure.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header:
        return (
            None,
            None,
            (jsonify({"message": "No authorization token provided"}), 401),
        )

    token = auth_header.split(" ", 1)[1] if " " in auth_header else auth_header
    try:
        user = supabase.auth.get_user(token)
    except Exception:
        return None, None, (jsonify({"message": "Invalid or expired token"}), 401)
    if not user or not getattr(user, "user", None):
        return None, None, (jsonify({"message": "Invalid or expired token"}), 401)

    try:
        db_user = (
            supabase.table("users")
            .select("*")
            .eq("auth_user_id", user.user.id)
            .limit(1)
            .execute()
        )
    except Exception:
        return None, None, (jsonify({"message": "Could not load user profile"}), 503)

    return user.user, (db_user.data[0] if db_user.data else None), None


def _check_profile(db_user):
    """Return an error response if the profile is missing or deactivated."""
    if not db_user:
        return jsonify({"message": "User profile not found"}), 403
    if db_user.get("is_active") is False:
        return jsonify({"message": "Account is deactivated"}), 403
    return None


def require_token(f):
    """Protect a route: any valid JWT; request.db_user may be None."""

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_user, db_user, error = _authenticate()
        if error:
            return error
        request.current_user = auth_user
        request.db_user = db_user
        request.is_service = False
        return f(*args, **kwargs)

    return decorated


def require_auth(f):
    """Protect a route: valid JWT and an active local user profile."""

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_user, db_user, error = _authenticate()
        if error:
            return error
        error = _check_profile(db_user)
        if error:
            return error
        request.current_user = auth_user
        request.db_user = db_user
        request.is_service = False
        return f(*args, **kwargs)

    return decorated


def require_admin(f):
    """Protect a route: only active admin/operator users."""

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_user, db_user, error = _authenticate()
        if error:
            return error
        error = _check_profile(db_user)
        if error:
            return error
        if not is_admin_user(db_user):
            return jsonify({"message": "Admin access required"}), 403
        request.current_user = auth_user
        request.db_user = db_user
        request.is_service = False
        return f(*args, **kwargs)

    return decorated


def _has_valid_service_key():
    provided = request.headers.get("X-Service-Key", "")
    return (
        bool(SERVICE_API_KEY)
        and bool(provided)
        and hmac.compare_digest(provided, SERVICE_API_KEY)
    )


def require_service_or_admin(f):
    """
    Protect machine endpoints (gate entry/exit, detection logging):
    accepts the SentraAI service key OR an admin/operator JWT.
    """

    @wraps(f)
    def decorated(*args, **kwargs):
        if _has_valid_service_key():
            request.current_user = None
            request.db_user = None
            request.is_service = True
            return f(*args, **kwargs)
        return require_admin(f)(*args, **kwargs)

    return decorated


def _create_notification(user_id, title, message, notif_type="system", data=None):
    """Helper: create a notification for a user."""
    try:
        supabase.table("notifications").insert(
            {
                "user_id": user_id,
                "title": title,
                "message": message,
                "type": notif_type,
                "data": data,
            }
        ).execute()
    except Exception:
        pass  # Non-critical: don't fail the main operation
