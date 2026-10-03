"""
routes_reports.py - Financial and usage reports (FR-11)
=======================================================
Daily revenue, peak hours, a weekday x hour occupancy heatmap and a CSV
export of parking sessions. Days and hours are bucketed in the facility's
local time (REPORT_TIMEZONE, default Asia/Colombo), not UTC.
"""

import csv
import io
import os
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from flask import Response, jsonify, request
from app import app, supabase
from routes_common import require_admin

REPORT_TZ = ZoneInfo(os.getenv("REPORT_TIMEZONE", "Asia/Colombo"))
MAX_DAYS = 365
PAGE_SIZE = 1000  # Supabase returns at most 1000 rows per request

SESSION_FIELDS = (
    "id, plate_number, spot_name, entry_time, exit_time, duration_minutes, "
    "amount, payment_status, session_type, entry_method"
)


def local_day_start(days_ago=0):
    """Midnight in the report timezone, `days_ago` days back, as UTC."""
    today = datetime.now(REPORT_TZ).date() - timedelta(days=days_ago)
    return datetime.combine(today, time.min, tzinfo=REPORT_TZ).astimezone(timezone.utc)


def _parse_ts(value):
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(REPORT_TZ)


def _report_args():
    """(facility_id, days) from the query string, or an error response."""
    facility_id = request.args.get("facility_id", type=int)
    if not facility_id:
        return None, None, (jsonify({"message": "facility_id is required"}), 400)
    days = request.args.get("days", 30, type=int)
    return facility_id, min(max(days, 1), MAX_DAYS), None


def _fetch_sessions(facility_id, since_utc):
    """All sessions that entered or exited since `since_utc`, paginated."""
    since = since_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
    rows, offset = [], 0
    while True:
        page = (
            supabase.table("parking_sessions")
            .select(SESSION_FIELDS)
            .eq("facility_id", facility_id)
            .or_(f"entry_time.gte.{since},exit_time.gte.{since}")
            .order("entry_time")
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        ).data or []
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            return rows
        offset += PAGE_SIZE


def build_summary(sessions, days, now=None):
    """Aggregate sessions into the report structure (pure, easy to test)."""
    now = (now or datetime.now(timezone.utc)).astimezone(REPORT_TZ)
    first_day = now.date() - timedelta(days=days - 1)
    daily = {
        first_day + timedelta(days=i): {"entries": 0, "revenue": 0, "collected": 0}
        for i in range(days)
    }
    hourly = [0] * 24
    heatmap = [[0] * 24 for _ in range(7)]  # [weekday Mon=0][hour]
    by_type, by_method = {}, {}
    durations, plates = [], set()
    totals = {"entries": 0, "exits": 0, "active": 0, "revenue": 0, "collected": 0}

    for s in sessions:
        entry, exit_ = _parse_ts(s.get("entry_time")), _parse_ts(s.get("exit_time"))
        amount = s.get("amount") or 0

        if entry and entry.date() >= first_day:
            totals["entries"] += 1
            daily[entry.date()]["entries"] += 1
            hourly[entry.hour] += 1
            heatmap[entry.weekday()][entry.hour] += 1
            plates.add(s.get("plate_number"))
            kind = s.get("session_type") or "walk_in"
            by_type[kind] = by_type.get(kind, 0) + 1
            method = s.get("entry_method") or "lpr"
            by_method[method] = by_method.get(method, 0) + 1
            if not exit_:
                totals["active"] += 1

        # Revenue is booked on the day the vehicle exits (when the fee is charged)
        if exit_ and exit_.date() >= first_day:
            totals["exits"] += 1
            daily[exit_.date()]["revenue"] += amount
            totals["revenue"] += amount
            if s.get("payment_status") == "paid":
                daily[exit_.date()]["collected"] += amount
                totals["collected"] += amount
            if s.get("duration_minutes") is not None:
                durations.append(s["duration_minutes"])

    peak_hour = max(range(24), key=lambda h: hourly[h]) if any(hourly) else None
    weekday_totals = [sum(row) for row in heatmap]
    peak_weekday = (
        max(range(7), key=lambda d: weekday_totals[d]) if any(weekday_totals) else None
    )

    return {
        "days": days,
        "timezone": str(REPORT_TZ),
        "totals": {
            **totals,
            "pending": totals["revenue"] - totals["collected"],
            "unique_vehicles": len(plates),
            "avg_duration_minutes": (
                round(sum(durations) / len(durations)) if durations else 0
            ),
        },
        "daily": [{"date": d.isoformat(), **v} for d, v in sorted(daily.items())],
        "hourly": [{"hour": h, "entries": hourly[h]} for h in range(24)],
        "heatmap": heatmap,
        "peak_hour": peak_hour,
        "peak_weekday": peak_weekday,
        "by_session_type": by_type,
        "by_entry_method": by_method,
    }


@app.route("/api/reports/summary", methods=["GET"])
@require_admin
def report_summary():
    """
    GET /api/reports/summary?facility_id=1&days=30
    Revenue per day, entries per hour, weekday x hour heatmap, peak hour/day.
    """
    facility_id, days, error = _report_args()
    if error:
        return error
    sessions = _fetch_sessions(facility_id, local_day_start(days - 1))
    return jsonify(build_summary(sessions, days)), 200


CSV_COLUMNS = [
    "id",
    "plate_number",
    "spot_name",
    "entry_time",
    "exit_time",
    "duration_minutes",
    "amount",
    "payment_status",
    "session_type",
    "entry_method",
]


@app.route("/api/reports/sessions.csv", methods=["GET"])
@require_admin
def report_sessions_csv():
    """GET /api/reports/sessions.csv?facility_id=1&days=30 – Session export."""
    facility_id, days, error = _report_args()
    if error:
        return error
    sessions = _fetch_sessions(facility_id, local_day_start(days - 1))

    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=CSV_COLUMNS, extrasaction="ignore")
    writer.writeheader()
    for s in sessions:
        row = dict(s)
        for key in ("entry_time", "exit_time"):
            ts = _parse_ts(row.get(key))
            row[key] = ts.strftime("%Y-%m-%d %H:%M:%S") if ts else ""
        writer.writerow(row)

    filename = f"sentra-sessions-facility{facility_id}-{days}d.csv"
    return Response(
        out.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
