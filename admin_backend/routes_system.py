"""
routes_system.py - System and health endpoints
==============================================
System reset and LPR health check.
"""

import httpx
from flask import request, jsonify
from app import app, supabase
from routes_common import require_admin, LPR_SERVICE_URL


# ==========================================================================
# 15. SYSTEM
# ==========================================================================


@app.route("/api/system/reset", methods=["POST"])
@require_admin
def reset_system():
    """POST /api/system/reset – Clear all sessions, free all spots. DESTRUCTIVE."""
    facility_id = request.get_json().get("facility_id") if request.get_json() else None

    try:
        if facility_id:
            supabase.table("parking_sessions").delete().eq(
                "facility_id", facility_id
            ).neq("id", 0).execute()
            supabase.table("reservations").delete().eq("facility_id", facility_id).neq(
                "id", 0
            ).execute()
            supabase.table("parking_spots").update(
                {
                    "is_occupied": False,
                    "is_reserved": False,
                }
            ).eq("facility_id", facility_id).neq("id", 0).execute()
        else:
            supabase.table("parking_sessions").delete().neq("id", 0).execute()
            supabase.table("reservations").delete().neq("id", 0).execute()
            supabase.table("parking_spots").update(
                {
                    "is_occupied": False,
                    "is_reserved": False,
                }
            ).neq("id", 0).execute()

        return jsonify({"message": "System reset! All spots are now free."}), 200
    except Exception as e:
        return jsonify({"message": f"Reset failed: {str(e)}"}), 500


@app.route("/api/lpr/status", methods=["GET"])
@require_admin
def lpr_status():
    """GET /api/lpr/status – Health check for SentraAI LPR service."""
    try:
        response = httpx.get(f"{LPR_SERVICE_URL}/api/health", timeout=5.0)
        if response.status_code == 200:
            data = response.json()
            return jsonify({"connected": True, **data}), 200
        return jsonify({"connected": False, "message": "Service unavailable"}), 503
    except Exception as e:
        return jsonify({"connected": False, "message": str(e)}), 503
