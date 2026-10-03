"""
Security regression tests (Phase 1).

Covers: removed endpoints, machine-endpoint auth (service key / admin),
ownership checks, role-escalation rules, and malformed-body handling.
"""

import json
from unittest.mock import MagicMock, patch

AUTH = {"Authorization": "Bearer test-token"}
SERVICE_KEY = "test-service-key"


def _mock_tables(mock_supabase, data_by_table):
    """
    Make supabase.table(name) return a chainable mock whose execute().data
    is data_by_table[name] (default []). Returns {name: mock} for assertions.
    """
    mocks = {}

    def table(name):
        if name not in mocks:
            m = MagicMock()
            for method in (
                "select",
                "insert",
                "update",
                "delete",
                "eq",
                "neq",
                "order",
                "limit",
                "in_",
                "is_",
                "gte",
                "lte",
            ):
                getattr(m, method).return_value = m
            m.execute.return_value = MagicMock(data=data_by_table.get(name, []))
            mocks[name] = m
        return mocks[name]

    mock_supabase.table.side_effect = table
    return mocks


def _login_as(mock_supabase, user_id=1, role="user", is_active=True):
    """Mock a valid JWT for a local user; returns the db_user dict."""
    mock_supabase.auth.get_user.return_value = MagicMock(
        user=MagicMock(id=f"auth-{user_id}")
    )
    return {
        "id": user_id,
        "email": f"u{user_id}@test.com",
        "role": role,
        "auth_user_id": f"auth-{user_id}",
        "is_active": is_active,
    }


# ── Removed endpoints ───────────────────────────────────────────────────


def test_legacy_reset_system_removed(client):
    """The unauthenticated /api/reset-system must no longer exist."""
    assert client.post("/api/reset-system").status_code in (404, 405)


def test_free_wallet_topup_removed(client, mock_supabase):
    """POST /api/wallet/topup (credit without payment) must no longer exist."""
    user = _login_as(mock_supabase)
    _mock_tables(mock_supabase, {"users": [user]})
    resp = client.post(
        "/api/wallet/topup",
        data=json.dumps({"amount": 100000}),
        content_type="application/json",
        headers=AUTH,
    )
    assert resp.status_code in (404, 405)


# ── Machine endpoints: service key or admin ─────────────────────────────


def test_session_entry_requires_auth(client):
    resp = client.post(
        "/api/sessions/entry",
        data=json.dumps({"plate_number": "WP CAB-1234", "facility_id": 1}),
        content_type="application/json",
    )
    assert resp.status_code == 401


def test_session_exit_requires_auth(client):
    resp = client.post(
        "/api/sessions/exit",
        data=json.dumps({"plate_number": "WP CAB-1234"}),
        content_type="application/json",
    )
    assert resp.status_code == 401


def test_legacy_vehicle_exit_requires_auth(client):
    resp = client.post(
        "/api/vehicle/exit",
        data=json.dumps({"plate_number": "WP CAB-1234"}),
        content_type="application/json",
    )
    assert resp.status_code == 401


def test_detection_post_requires_auth(client):
    resp = client.post(
        "/api/detections",
        data=json.dumps({"camera_id": "entry_cam_01", "plate_number": "WP CAB-1234"}),
        content_type="application/json",
    )
    assert resp.status_code == 401


def test_session_entry_rejects_regular_user(client, mock_supabase):
    """A normal user JWT must not be able to open gates."""
    user = _login_as(mock_supabase, role="user")
    _mock_tables(mock_supabase, {"users": [user]})
    resp = client.post(
        "/api/sessions/entry",
        data=json.dumps({"plate_number": "WP CAB-1234", "facility_id": 1}),
        content_type="application/json",
        headers=AUTH,
    )
    assert resp.status_code == 403


@patch("routes_common.SERVICE_API_KEY", SERVICE_KEY)
def test_session_entry_accepts_service_key(client, mock_supabase):
    """With the service key, the request reaches entry logic (unregistered → 403 deny)."""
    _mock_tables(mock_supabase, {"parking_sessions": [], "vehicles": []})
    resp = client.post(
        "/api/sessions/entry",
        data=json.dumps({"plate_number": "WP CAB-1234", "facility_id": 1}),
        content_type="application/json",
        headers={"X-Service-Key": SERVICE_KEY},
    )
    body = json.loads(resp.data)
    assert body["gate_action"] == "deny"
    assert body["requires_registration"] is True


def test_service_key_disabled_when_unset(client):
    """If SERVICE_API_KEY is not configured, any X-Service-Key is rejected."""
    with patch("routes_common.SERVICE_API_KEY", ""):
        resp = client.post(
            "/api/sessions/exit",
            data=json.dumps({"plate_number": "X"}),
            content_type="application/json",
            headers={"X-Service-Key": ""},
        )
    assert resp.status_code == 401


# ── Profile checks ──────────────────────────────────────────────────────


def test_missing_profile_is_403_not_500(client, mock_supabase):
    """Valid JWT but no local users row → 403 (previously crashed with 500)."""
    _login_as(mock_supabase)
    _mock_tables(mock_supabase, {"users": []})
    resp = client.get("/api/sessions", headers=AUTH)
    assert resp.status_code == 403


def test_deactivated_user_blocked(client, mock_supabase):
    user = _login_as(mock_supabase, is_active=False)
    _mock_tables(mock_supabase, {"users": [user]})
    resp = client.get("/api/vehicles", headers=AUTH)
    assert resp.status_code == 403


def test_route_errors_are_not_reported_as_auth_failures(client, mock_supabase):
    """A bug inside a route must surface as 500, not a misleading 401."""
    user = _login_as(mock_supabase)
    tables = _mock_tables(mock_supabase, {"users": [user]})
    tables_vehicles = mock_supabase.table("vehicles")
    tables_vehicles.execute.side_effect = RuntimeError("db exploded")
    client.application.config["PROPAGATE_EXCEPTIONS"] = False
    try:
        resp = client.get("/api/vehicles", headers=AUTH)
    finally:
        client.application.config["PROPAGATE_EXCEPTIONS"] = None
    assert resp.status_code == 500
    assert tables["users"].execute.called


# ── Ownership ───────────────────────────────────────────────────────────


def test_cannot_update_someone_elses_vehicle(client, mock_supabase):
    user = _login_as(mock_supabase, user_id=1)
    tables = _mock_tables(
        mock_supabase,
        {"users": [user], "vehicles": [{"id": 9, "user_id": 2, "is_active": True}]},
    )
    resp = client.put(
        "/api/vehicles/9",
        data=json.dumps({"color": "red"}),
        content_type="application/json",
        headers=AUTH,
    )
    assert resp.status_code == 403
    tables["vehicles"].update.assert_not_called()


def test_cannot_delete_someone_elses_vehicle(client, mock_supabase):
    user = _login_as(mock_supabase, user_id=1)
    tables = _mock_tables(
        mock_supabase,
        {"users": [user], "vehicles": [{"id": 9, "user_id": 2, "is_active": True}]},
    )
    resp = client.delete("/api/vehicles/9", headers=AUTH)
    assert resp.status_code == 403
    tables["vehicles"].update.assert_not_called()


def test_owner_can_update_own_vehicle(client, mock_supabase):
    user = _login_as(mock_supabase, user_id=1)
    _mock_tables(
        mock_supabase,
        {"users": [user], "vehicles": [{"id": 9, "user_id": 1, "is_active": True}]},
    )
    resp = client.put(
        "/api/vehicles/9",
        data=json.dumps({"color": "red"}),
        content_type="application/json",
        headers=AUTH,
    )
    assert resp.status_code == 200


def test_cannot_view_someone_elses_reservation(client, mock_supabase):
    user = _login_as(mock_supabase, user_id=1)
    _mock_tables(
        mock_supabase, {"users": [user], "reservations": [{"id": 5, "user_id": 2}]}
    )
    resp = client.get("/api/reservations/5", headers=AUTH)
    assert resp.status_code == 404


def test_user_cannot_mark_own_reservation_paid(client, mock_supabase):
    """Owners may only cancel; payment/amount edits are admin-only."""
    user = _login_as(mock_supabase, user_id=1)
    tables = _mock_tables(
        mock_supabase,
        {
            "users": [user],
            "reservations": [
                {"id": 5, "user_id": 1, "status": "pending", "spot_id": 3}
            ],
        },
    )
    resp = client.put(
        "/api/reservations/5",
        data=json.dumps({"payment_status": "paid", "amount": 0}),
        content_type="application/json",
        headers=AUTH,
    )
    assert resp.status_code == 403
    tables["reservations"].update.assert_not_called()


def test_owner_can_cancel_own_reservation(client, mock_supabase):
    user = _login_as(mock_supabase, user_id=1)
    _mock_tables(
        mock_supabase,
        {
            "users": [user],
            "reservations": [
                {"id": 5, "user_id": 1, "status": "confirmed", "spot_id": 3}
            ],
        },
    )
    resp = client.put(
        "/api/reservations/5",
        data=json.dumps({"action": "cancel"}),
        content_type="application/json",
        headers=AUTH,
    )
    assert resp.status_code == 200


def test_cannot_reserve_with_someone_elses_vehicle(client, mock_supabase):
    user = _login_as(mock_supabase, user_id=1)
    _mock_tables(
        mock_supabase,
        {"users": [user], "vehicles": [{"id": 9, "user_id": 2, "is_active": True}]},
    )
    resp = client.post(
        "/api/reservations",
        data=json.dumps(
            {
                "vehicle_id": 9,
                "facility_id": 1,
                "reserved_start": "2026-10-10T09:00:00+00:00",
                "reserved_end": "2026-10-10T11:00:00+00:00",
            }
        ),
        content_type="application/json",
        headers=AUTH,
    )
    assert resp.status_code == 404


def test_reservation_end_must_be_after_start(client, mock_supabase):
    user = _login_as(mock_supabase, user_id=1)
    _mock_tables(mock_supabase, {"users": [user]})
    resp = client.post(
        "/api/reservations",
        data=json.dumps(
            {
                "vehicle_id": 9,
                "facility_id": 1,
                "reserved_start": "2026-10-10T11:00:00+00:00",
                "reserved_end": "2026-10-10T09:00:00+00:00",
            }
        ),
        content_type="application/json",
        headers=AUTH,
    )
    assert resp.status_code == 400


def test_cannot_cancel_someone_elses_subscription(client, mock_supabase):
    user = _login_as(mock_supabase, user_id=1)
    tables = _mock_tables(
        mock_supabase, {"users": [user], "subscriptions": [{"id": 4, "user_id": 2}]}
    )
    resp = client.put(
        "/api/subscriptions/4",
        data=json.dumps({"action": "cancel"}),
        content_type="application/json",
        headers=AUTH,
    )
    assert resp.status_code == 404
    tables["subscriptions"].update.assert_not_called()


def test_mark_notification_read_scoped_to_owner(client, mock_supabase):
    user = _login_as(mock_supabase, user_id=1)
    tables = _mock_tables(mock_supabase, {"users": [user]})
    resp = client.put("/api/notifications/77/read", headers=AUTH)
    assert resp.status_code == 200
    tables["notifications"].eq.assert_any_call("user_id", 1)


# ── Role management ─────────────────────────────────────────────────────


def test_operator_cannot_change_roles(client, mock_supabase):
    operator = _login_as(mock_supabase, user_id=1, role="operator")
    tables = _mock_tables(mock_supabase, {"users": [operator]})
    resp = client.put(
        "/api/admin/users/2",
        data=json.dumps({"role": "admin"}),
        content_type="application/json",
        headers=AUTH,
    )
    assert resp.status_code == 403
    tables["users"].update.assert_not_called()


def test_admin_cannot_demote_self(client, mock_supabase):
    admin = _login_as(mock_supabase, user_id=1, role="admin")
    _mock_tables(mock_supabase, {"users": [admin]})
    resp = client.put(
        "/api/admin/users/1",
        data=json.dumps({"role": "user"}),
        content_type="application/json",
        headers=AUTH,
    )
    assert resp.status_code == 400


def test_admin_can_promote_user(client, mock_supabase):
    admin = _login_as(mock_supabase, user_id=1, role="admin")
    _mock_tables(mock_supabase, {"users": [admin]})
    resp = client.put(
        "/api/admin/users/2",
        data=json.dumps({"role": "operator"}),
        content_type="application/json",
        headers=AUTH,
    )
    assert resp.status_code == 200


def test_social_login_creates_user_role(client, mock_supabase):
    """First-time OAuth users must be 'user', never auto-admin."""
    mock_supabase.auth.get_user.return_value = MagicMock(
        user=MagicMock(id="auth-new", email="new@test.com", user_metadata={})
    )
    created = {"id": 10, "email": "new@test.com", "role": "user"}
    tables = _mock_tables(mock_supabase, {"users": [], "user_wallets": []})
    tables_users = mock_supabase.table("users")
    # profile lookup (none), email lookup (none), insert returns the created row
    tables_users.execute.side_effect = [
        MagicMock(data=[]),
        MagicMock(data=[]),
        MagicMock(data=[created]),
    ]
    resp = client.post("/api/auth/social-login", headers=AUTH)
    assert resp.status_code == 201
    assert tables["users"].insert.call_args.args[0]["role"] == "user"


# ── Malformed bodies ────────────────────────────────────────────────────


def test_non_json_body_returns_400(client, mock_supabase):
    user = _login_as(mock_supabase)
    _mock_tables(mock_supabase, {"users": [user]})
    resp = client.post(
        "/api/vehicles", data="not json", content_type="text/plain", headers=AUTH
    )
    assert resp.status_code == 400
