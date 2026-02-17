"""
routes_notifications.py - User notifications
============================================
Endpoints for retrieving and marking notifications.
"""

from flask import request, jsonify
from app import app, supabase
from routes_common import require_auth


# ==========================================================================
# 13. NOTIFICATIONS
# ==========================================================================


@app.route("/api/notifications", methods=["GET"])
@require_auth
def get_notifications():
    """GET /api/notifications – Get current user's notifications."""
    limit = request.args.get("limit", 50, type=int)
    result = (
        supabase.table("notifications")
        .select("*")
        .eq("user_id", request.db_user["id"])
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return jsonify({"notifications": result.data}), 200


@app.route("/api/notifications/<int:notif_id>/read", methods=["PUT"])
@require_auth
def mark_notification_read(notif_id):
    """PUT /api/notifications/:id/read – Mark one notification as read."""
    supabase.table("notifications").update({"is_read": True}).eq(
        "id", notif_id
    ).execute()
    return jsonify({"message": "Marked as read"}), 200


@app.route("/api/notifications/read-all", methods=["PUT"])
@require_auth
def mark_all_notifications_read():
    """PUT /api/notifications/read-all – Mark all notifications as read."""
    supabase.table("notifications").update({"is_read": True}).eq(
        "user_id", request.db_user["id"]
    ).eq("is_read", False).execute()
    return jsonify({"message": "All notifications marked as read"}), 200
