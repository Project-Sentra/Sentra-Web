"""
Tests for gate control (FR-12): manual open/close, the event log and
automatic LPR event recording.
"""

from unittest.mock import MagicMock

from tests.test_security import AUTH, _login_as, _mock_tables

GATE = {"id": 4, "facility_id": 1, "name": "Main Entry", "gate_type": "entry"}


def test_gates_require_admin(client, mock_supabase):
    user = _login_as(mock_supabase, role="user")
    _mock_tables(mock_supabase, {"users": [user]})
    assert client.post("/api/gates/4/open", headers=AUTH).status_code == 403


def test_open_gate_updates_status_and_logs_operator(client, mock_supabase):
    admin = _login_as(mock_supabase, user_id=9, role="admin")
    tables = _mock_tables(mock_supabase, {"users": [admin], "gates": [GATE]})

    resp = client.post(
        "/api/gates/4/open", json={"plate_number": " wp cab-1234 "}, headers=AUTH
    )

    assert resp.status_code == 200
    tables["gates"].update.assert_called_once_with({"status": "open"})
    event = tables["gate_events"].insert.call_args[0][0]
    assert event == {
        "gate_id": 4,
        "event_type": "open",
        "triggered_by": "manual",
        "operator_id": 9,
        "plate_number": "WP CAB-1234",
    }


def test_close_gate_logs_close_event(client, mock_supabase):
    admin = _login_as(mock_supabase, role="admin")
    tables = _mock_tables(mock_supabase, {"users": [admin], "gates": [GATE]})

    resp = client.post("/api/gates/4/close", headers=AUTH)

    assert resp.status_code == 200
    tables["gates"].update.assert_called_once_with({"status": "closed"})
    assert tables["gate_events"].insert.call_args[0][0]["event_type"] == "close"


def test_unknown_gate_returns_404(client, mock_supabase):
    admin = _login_as(mock_supabase, role="admin")
    tables = _mock_tables(mock_supabase, {"users": [admin], "gates": []})

    assert client.post("/api/gates/99/open", headers=AUTH).status_code == 404
    assert "gate_events" not in tables
    tables["gates"].update.assert_not_called()


def test_add_gate_rejects_unknown_type(client, mock_supabase):
    admin = _login_as(mock_supabase, role="admin")
    _mock_tables(mock_supabase, {"users": [admin]})

    resp = client.post(
        "/api/gates",
        json={"name": "Side", "gate_type": "sideways", "facility_id": 1},
        headers=AUTH,
    )
    assert resp.status_code == 400


def test_gate_events_filtered_by_facility(client, mock_supabase):
    admin = _login_as(mock_supabase, role="admin")
    events = [
        {"id": 1, "gate_id": 4, "gates": {"facility_id": 1}},
        {"id": 2, "gate_id": 7, "gates": {"facility_id": 2}},
    ]
    _mock_tables(mock_supabase, {"users": [admin], "gate_events": events})

    resp = client.get("/api/gates/events?facility_id=1", headers=AUTH)

    assert resp.status_code == 200
    assert [e["id"] for e in resp.get_json()["events"]] == [1]


def test_record_lpr_gate_open_prefers_dedicated_gate(mock_supabase):
    from routes_gates import record_lpr_gate_open

    gates = [
        {"id": 2, "gate_type": "bidirectional"},
        {"id": 5, "gate_type": "exit"},
    ]
    tables = _mock_tables(mock_supabase, {"gates": gates})

    record_lpr_gate_open(1, "exit", "ABC-1234", vehicle_id=3)

    event = tables["gate_events"].insert.call_args[0][0]
    assert event["gate_id"] == 5
    assert event["triggered_by"] == "auto_lpr"
    assert event["plate_number"] == "ABC-1234"


def test_record_lpr_gate_open_never_raises(mock_supabase):
    from routes_gates import record_lpr_gate_open

    mock_supabase.table.side_effect = RuntimeError("database down")
    record_lpr_gate_open(1, "entry", "ABC-1234")  # must not raise


def test_record_lpr_gate_open_without_gates_is_noop(mock_supabase):
    from routes_gates import record_lpr_gate_open

    tables = _mock_tables(mock_supabase, {"gates": []})
    record_lpr_gate_open(1, "entry", "ABC-1234")
    assert "gate_events" not in tables or not tables["gate_events"].insert.called


def test_lpr_exit_records_gate_event(client, mock_supabase, monkeypatch):
    """A successful exit through the service key logs an auto_lpr gate open."""
    import routes_common
    import routes_sessions

    monkeypatch.setattr(routes_common, "SERVICE_API_KEY", "svc")
    recorded = MagicMock()
    monkeypatch.setattr(routes_sessions, "record_lpr_gate_open", recorded)
    session = {
        "id": 1,
        "facility_id": 1,
        "spot_id": None,
        "spot_name": "A1",
        "plate_number": "ABC-1234",
        "entry_time": "2026-10-03T08:00:00+00:00",
        "session_type": "walk_in",
        "vehicle_id": None,
        "reservation_id": None,
    }
    _mock_tables(
        mock_supabase,
        {"parking_sessions": [session], "facilities": [{"hourly_rate": 150}]},
    )

    resp = client.post(
        "/api/sessions/exit",
        json={"plate_number": "ABC-1234"},
        headers={"X-Service-Key": "svc"},
    )

    assert resp.status_code == 200
    recorded.assert_called_once_with(1, "exit", "ABC-1234", None)
