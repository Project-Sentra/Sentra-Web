"""
Tests for financial and usage reports (FR-11).
Times are UTC in the data and Asia/Colombo (UTC+5:30) in the report.
"""

from datetime import datetime, timezone

from routes_reports import build_summary, local_day_start
from tests.test_security import AUTH, _login_as, _mock_tables

NOW = datetime(2026, 10, 3, 12, 0, tzinfo=timezone.utc)  # 17:30 in Colombo


def _session(entry, exit_=None, amount=None, status="pending", **extra):
    return {
        "plate_number": extra.pop("plate", "ABC-1234"),
        "entry_time": entry,
        "exit_time": exit_,
        "amount": amount,
        "payment_status": status,
        "duration_minutes": extra.pop("duration", None),
        "session_type": extra.pop("session_type", "walk_in"),
        "entry_method": "lpr",
        **extra,
    }


def test_days_and_hours_use_sri_lanka_time():
    # 2026-10-02 20:00 UTC is 2026-10-03 01:30 in Colombo
    report = build_summary([_session("2026-10-02T20:00:00+00:00")], days=7, now=NOW)

    today = next(d for d in report["daily"] if d["date"] == "2026-10-03")
    assert today["entries"] == 1
    assert report["hourly"][1]["entries"] == 1
    assert report["peak_hour"] == 1
    assert report["peak_weekday"] == 5  # Saturday


def test_revenue_is_booked_on_exit_day_and_split_by_payment():
    sessions = [
        _session(
            "2026-10-03T03:00:00Z",
            "2026-10-03T05:00:00Z",
            300,
            "paid",
            duration=120,
        ),
        _session(
            "2026-10-03T04:00:00Z",
            "2026-10-03T05:00:00Z",
            150,
            "pending",
            duration=60,
            plate="XYZ-9999",
        ),
        _session("2026-10-03T06:00:00Z", plate="NEW-0001"),  # still parked
    ]
    report = build_summary(sessions, days=1, now=NOW)

    totals = report["totals"]
    assert totals["entries"] == 3
    assert totals["exits"] == 2
    assert totals["active"] == 1
    assert totals["revenue"] == 450
    assert totals["collected"] == 300
    assert totals["pending"] == 150
    assert totals["unique_vehicles"] == 3
    assert totals["avg_duration_minutes"] == 90
    assert report["daily"] == [
        {"date": "2026-10-03", "entries": 3, "revenue": 450, "collected": 300}
    ]


def test_every_day_in_range_is_present_even_without_data():
    report = build_summary([], days=30, now=NOW)

    assert len(report["daily"]) == 30
    assert report["daily"][-1]["date"] == "2026-10-03"
    assert report["peak_hour"] is None
    assert report["totals"]["avg_duration_minutes"] == 0


def test_session_before_range_counts_only_its_exit():
    sessions = [
        _session(
            "2026-09-01T03:00:00Z", "2026-10-03T03:00:00Z", 900, "paid", duration=60
        )
    ]
    report = build_summary(sessions, days=7, now=NOW)

    assert report["totals"]["entries"] == 0
    assert report["totals"]["revenue"] == 900


def test_local_day_start_is_colombo_midnight():
    start = local_day_start()
    assert start.tzinfo is not None
    # Colombo midnight is 18:30 UTC the previous day
    assert (start.hour, start.minute) == (18, 30)


def test_summary_requires_admin(client, mock_supabase):
    user = _login_as(mock_supabase, role="user")
    _mock_tables(mock_supabase, {"users": [user]})
    resp = client.get("/api/reports/summary?facility_id=1", headers=AUTH)
    assert resp.status_code == 403


def test_summary_requires_facility(client, mock_supabase):
    admin = _login_as(mock_supabase, role="admin")
    _mock_tables(mock_supabase, {"users": [admin]})
    resp = client.get("/api/reports/summary", headers=AUTH)
    assert resp.status_code == 400


def test_summary_endpoint_returns_report(client, mock_supabase):
    admin = _login_as(mock_supabase, role="admin")
    tables = _mock_tables(mock_supabase, {"users": [admin], "parking_sessions": []})
    tables_sessions = mock_supabase.table("parking_sessions")
    tables_sessions.or_.return_value = tables_sessions
    tables_sessions.range.return_value = tables_sessions

    resp = client.get("/api/reports/summary?facility_id=1&days=999", headers=AUTH)

    assert resp.status_code == 200
    assert resp.get_json()["days"] == 365  # clamped
    assert "parking_sessions" in tables


def test_csv_export(client, mock_supabase):
    admin = _login_as(mock_supabase, role="admin")
    rows = [
        {
            "id": 1,
            "plate_number": "ABC-1234",
            "spot_name": "A1",
            "entry_time": "2026-10-03T03:00:00+00:00",
            "exit_time": None,
            "amount": None,
            "payment_status": "pending",
            "session_type": "walk_in",
            "entry_method": "lpr",
            "duration_minutes": None,
        }
    ]
    _mock_tables(mock_supabase, {"users": [admin], "parking_sessions": rows})
    sessions = mock_supabase.table("parking_sessions")
    sessions.or_.return_value = sessions
    sessions.range.return_value = sessions

    resp = client.get("/api/reports/sessions.csv?facility_id=1&days=7", headers=AUTH)

    assert resp.status_code == 200
    assert resp.mimetype == "text/csv"
    assert "attachment" in resp.headers["Content-Disposition"]
    lines = resp.get_data(as_text=True).strip().splitlines()
    assert lines[0].startswith("id,plate_number,spot_name,entry_time")
    assert "ABC-1234,A1,2026-10-03 08:30:00" in lines[1]  # Colombo local time
