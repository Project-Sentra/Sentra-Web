"""
routes_dashboard.py - Dashboard analytics
=========================================
Admin analytics endpoints.
"""

from datetime import datetime, timezone
from flask import request, jsonify
from app import app, supabase
from routes_common import require_admin

# ==========================================================================
# 14. DASHBOARD / ANALYTICS (Admin)
# ==========================================================================


@app.route("/api/dashboard/stats", methods=["GET"])
@require_admin
def dashboard_stats():
    """
    GET /api/dashboard/stats?facility_id=1
    Get dashboard statistics for a facility.
    """
    facility_id = request.args.get("facility_id", type=int)
    if not facility_id:
        return jsonify({"message": "facility_id is required"}), 400

    # Spots summary
    spots = (
        supabase.table("parking_spots")
        .select("is_occupied, is_reserved")
        .eq("facility_id", facility_id)
        .eq("is_active", True)
        .execute()
    )
    total_spots = len(spots.data)
    occupied = sum(1 for s in spots.data if s["is_occupied"])
    reserved = sum(1 for s in spots.data if s["is_reserved"] and not s["is_occupied"])
    available = total_spots - occupied - reserved

    # Today's sessions and revenue
    today_start = (
        datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
    )
    today_sessions = (
        supabase.table("parking_sessions")
        .select("amount, payment_status")
        .eq("facility_id", facility_id)
        .gte("entry_time", today_start)
        .execute()
    )
    today_entries = len(today_sessions.data)
    today_revenue = sum(
        s.get("amount", 0) or 0
        for s in today_sessions.data
        if s.get("payment_status") == "paid"
    )

    # Active sessions
    active_sessions = (
        supabase.table("parking_sessions")
        .select("id")
        .eq("facility_id", facility_id)
        .is_("exit_time", "null")
        .execute()
    )

    # Today's reservations
    today_reservations = (
        supabase.table("reservations")
        .select("id")
        .eq("facility_id", facility_id)
        .gte("reserved_start", today_start)
        .execute()
    )

    # Registered users count
    total_users = supabase.table("users").select("id").eq("role", "user").execute()
    total_vehicles = (
        supabase.table("vehicles").select("id").eq("is_active", True).execute()
    )

    return (
        jsonify(
            {
                "spots": {
                    "total": total_spots,
                    "occupied": occupied,
                    "reserved": reserved,
                    "available": available,
                },
                "today": {
                    "entries": today_entries,
                    "revenue": today_revenue,
                    "active_sessions": len(active_sessions.data),
                    "reservations": len(today_reservations.data),
                },
                "system": {
                    "total_users": len(total_users.data),
                    "total_vehicles": len(total_vehicles.data),
                },
            }
        ),
        200,
    )


@app.route("/api/dashboard/recent-activity", methods=["GET"])
@require_admin
def recent_activity():
    """GET /api/dashboard/recent-activity – Recent sessions, detections, gate events."""
    facility_id = request.args.get("facility_id", type=int)
    limit = request.args.get("limit", 20, type=int)

    sessions = (
        supabase.table("parking_sessions")
        .select("*")
        .order("entry_time", desc=True)
        .limit(limit)
    )
    if facility_id:
        sessions = sessions.eq("facility_id", facility_id)
    sessions = sessions.execute()

    detections = (
        supabase.table("detection_logs")
        .select("*")
        .order("detected_at", desc=True)
        .limit(limit)
    )
    if facility_id:
        detections = detections.eq("facility_id", facility_id)
    detections = detections.execute()

    return (
        jsonify(
            {
                "recent_sessions": sessions.data,
                "recent_detections": detections.data,
            }
        ),
        200,
    )
