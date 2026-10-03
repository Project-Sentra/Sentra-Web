"""Tests for the demo data generator (seed_demo_data.generate_sessions)."""

from collections import Counter
from datetime import datetime, timezone

from routes_reports import build_summary
from seed_demo_data import generate_sessions

NOW = datetime(2026, 10, 3, 12, 0, tzinfo=timezone.utc)
SPOTS = [{"id": i, "spot_name": f"A-{i:02d}"} for i in range(1, 33)]


def _ts(value):
    return datetime.fromisoformat(value)


def _sessions(days=30):
    return generate_sessions(1, SPOTS, 150, days, now=NOW)


def test_only_finished_sessions_in_the_past():
    sessions = _sessions()
    assert sessions
    for s in sessions:
        assert _ts(s["entry_time"]) < _ts(s["exit_time"]) < NOW


def test_no_spot_is_double_booked():
    by_spot = {}
    for s in _sessions():
        by_spot.setdefault(s["spot_id"], []).append(s)
    for stays in by_spot.values():
        stays.sort(key=lambda s: s["entry_time"])
        for earlier, later in zip(stays, stays[1:]):
            assert _ts(earlier["exit_time"]) <= _ts(later["entry_time"])


def test_fees_follow_the_hourly_rate():
    for s in _sessions():
        if s["session_type"] == "subscription":
            assert (s["amount"], s["payment_status"]) == (0, "waived")
        else:
            hours = max(1, -(-s["duration_minutes"] // 60))
            assert s["amount"] == hours * 150
            assert s["payment_status"] in ("paid", "pending")


def test_is_reproducible():
    assert _sessions(7) == _sessions(7)


def test_produces_realistic_report():
    report = build_summary(_sessions(), 30, now=NOW)

    assert report["totals"]["entries"] > 500
    assert report["totals"]["pending"] > 0
    assert report["totals"]["unique_vehicles"] < report["totals"]["entries"]
    assert 7 <= report["peak_hour"] <= 18
    weekdays = Counter(_ts(s["entry_time"]).weekday() for s in _sessions())
    assert weekdays[6] < weekdays[4]  # Sundays are quieter than Fridays
