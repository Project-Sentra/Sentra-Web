"""
routes_users.py - Admin user management
=======================================
Admin-only endpoints for listing and updating users.
"""

from datetime import datetime, timezone
from flask import request, jsonify
from app import app, supabase
from routes_common import require_admin


# ==========================================================================
# 2. USER MANAGEMENT (Admin)
# ==========================================================================

@app.route("/api/admin/users", methods=["GET"])
@require_admin
def list_users():
    """GET /api/admin/users – List all users with optional role filter."""
    role_filter = request.args.get("role")
    query = supabase.table("users").select("*").order("created_at", desc=True)
    if role_filter:
        query = query.eq("role", role_filter)
    result = query.execute()
    return jsonify({"users": result.data}), 200


@app.route("/api/admin/users/<int:user_id>", methods=["GET"])
@require_admin
def get_user(user_id):
    """GET /api/admin/users/:id – Get user details with their vehicles."""
    user = supabase.table("users").select("*").eq("id", user_id).limit(1).execute()
    if not user.data:
        return jsonify({"message": "User not found"}), 404

    vehicles = (
        supabase.table("vehicles")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    return jsonify({"user": user.data[0], "vehicles": vehicles.data}), 200


@app.route("/api/admin/users/<int:user_id>", methods=["PUT"])
@require_admin
def update_user(user_id):
    """PUT /api/admin/users/:id – Update user role / active status."""
    data = request.get_json()
    updates = {}
    if "role" in data and data["role"] in ("admin", "user", "operator"):
        updates["role"] = data["role"]
    if "is_active" in data:
        updates["is_active"] = bool(data["is_active"])

    if not updates:
        return jsonify({"message": "No valid fields to update"}), 400

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    supabase.table("users").update(updates).eq("id", user_id).execute()
    return jsonify({"message": "User updated"}), 200
