"""
routes_common.py - Shared constants and auth helpers
====================================================
Centralizes shared constants, auth decorators, and small helpers used
across the route modules.
"""

import os
from flask import request, jsonify
from functools import wraps
from app import supabase

# External LPR service URL (use container name in Docker, localhost for local dev)
LPR_SERVICE_URL = os.getenv("LPR_SERVICE_URL", "http://127.0.0.1:5001")

# Defaults
DEFAULT_HOURLY_RATE = 150  # LKR per hour (fallback when facility has no rate)
DEFAULT_CURRENCY = "LKR"


def require_auth(f):
    """Protect a route: any valid JWT is accepted."""

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"message": "No authorization token provided"}), 401
        try:
            token = auth_header.split(" ")[1] if " " in auth_header else auth_header
            user = supabase.auth.get_user(token)
            if not user:
                return jsonify({"message": "Invalid or expired token"}), 401
            request.current_user = user.user
            # Attach local DB user record
            db_user = (
                supabase.table("users")
                .select("*")
                .eq("auth_user_id", user.user.id)
                .limit(1)
                .execute()
            )
            request.db_user = db_user.data[0] if db_user.data else None
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({"message": f"Authentication failed: {str(e)}"}), 401

    return decorated


def require_admin(f):
    """Protect a route: only admin users."""

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"message": "No authorization token provided"}), 401
        try:
            token = auth_header.split(" ")[1] if " " in auth_header else auth_header
            user = supabase.auth.get_user(token)
            if not user:
                return jsonify({"message": "Invalid or expired token"}), 401
            request.current_user = user.user
            db_user = (
                supabase.table("users")
                .select("*")
                .eq("auth_user_id", user.user.id)
                .limit(1)
                .execute()
            )
            if not db_user.data or db_user.data[0]["role"] not in ("admin", "operator"):
                return jsonify({"message": "Admin access required"}), 403
            request.db_user = db_user.data[0]
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({"message": f"Authentication failed: {str(e)}"}), 401

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
