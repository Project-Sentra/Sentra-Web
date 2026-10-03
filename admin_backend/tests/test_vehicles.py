"""Tests for vehicle management endpoints."""

import json
from unittest.mock import MagicMock, patch


def _setup_auth(mock_supabase, role="user"):
    """Helper to mock authenticated user."""
    mock_user = MagicMock()
    mock_user.id = "auth-uuid-123"

    mock_auth_resp = MagicMock()
    mock_auth_resp.user = mock_user
    mock_supabase.auth.get_user.return_value = mock_auth_resp

    db_user = {
        "id": 1,
        "email": "user@test.com",
        "role": role,
        "auth_user_id": "auth-uuid-123",
        "is_active": True,
    }

    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.limit.return_value = table_mock
    table_mock.execute.return_value = MagicMock(data=[db_user])
    mock_supabase.table.return_value = table_mock

    return db_user


def test_register_vehicle_no_token(client):
    """POST /api/vehicles without auth should return 401."""
    resp = client.post(
        "/api/vehicles",
        data=json.dumps({"plate_number": "WP CAB-1234"}),
        content_type="application/json",
    )
    assert resp.status_code == 401


def test_register_vehicle_missing_plate(client, mock_supabase):
    """POST /api/vehicles without plate_number should return 400."""
    _setup_auth(mock_supabase)

    with patch("routes_common.supabase", mock_supabase):
        resp = client.post(
            "/api/vehicles",
            data=json.dumps({}),
            content_type="application/json",
            headers={"Authorization": "Bearer test-token"},
        )
    assert resp.status_code == 400
    assert b"plate_number is required" in resp.data


SERVICE_HEADERS = {"X-Service-Key": "test-service-key"}


def test_lookup_vehicle_requires_auth(client):
    """Plate lookup exposes owner details, so it must not be public."""
    resp = client.get("/api/vehicles/lookup/WP-UNKNOWN")
    assert resp.status_code == 401


def test_lookup_vehicle_wrong_service_key(client):
    """A wrong service key must be rejected."""
    with patch("routes_common.SERVICE_API_KEY", "test-service-key"):
        resp = client.get(
            "/api/vehicles/lookup/WP-UNKNOWN", headers={"X-Service-Key": "wrong"}
        )
    assert resp.status_code == 401


@patch("routes_common.SERVICE_API_KEY", "test-service-key")
def test_lookup_vehicle_not_registered(client, mock_supabase):
    """GET /api/vehicles/lookup/:plate for unregistered plate."""
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.limit.return_value = table_mock
    table_mock.execute.return_value = MagicMock(data=[])
    mock_supabase.table.return_value = table_mock

    resp = client.get("/api/vehicles/lookup/WP-UNKNOWN", headers=SERVICE_HEADERS)
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["registered"] is False


@patch("routes_common.SERVICE_API_KEY", "test-service-key")
def test_lookup_vehicle_registered(client, mock_supabase):
    """GET /api/vehicles/lookup/:plate for registered plate."""
    vehicle_data = {
        "id": 1,
        "plate_number": "WP CAB-1234",
        "make": "Toyota",
        "users": {"id": 1, "email": "user@test.com", "full_name": "Test", "phone": ""},
    }

    call_count = [0]

    def table_side_effect(name):
        mock = MagicMock()
        mock.select.return_value = mock
        mock.eq.return_value = mock
        mock.limit.return_value = mock
        if name == "vehicles":
            mock.execute.return_value = MagicMock(data=[vehicle_data])
        elif name == "subscriptions":
            mock.execute.return_value = MagicMock(data=[])
        return mock

    mock_supabase.table.side_effect = table_side_effect

    resp = client.get("/api/vehicles/lookup/WP%20CAB-1234", headers=SERVICE_HEADERS)
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["registered"] is True
    assert data["has_subscription"] is False


def test_normalize_plate():
    """LPR, app and admin formats all collapse to one canonical key."""
    from routes_common import normalize_plate

    for raw in ("CAG 5124", "cag-5124", " CAG5124 ", "C.A.G 51-24"):
        assert normalize_plate(raw) == "CAG5124"
    assert normalize_plate("WP CA-1234") == "WPCA1234"
    assert normalize_plate(None) == ""


@patch("routes_common.SERVICE_API_KEY", "test-service-key")
def test_lookup_uses_canonical_plate(client, mock_supabase):
    """Lookup with the LPR format queries the canonical plate."""
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.limit.return_value = table_mock
    table_mock.execute.return_value = MagicMock(data=[])
    mock_supabase.table.return_value = table_mock

    resp = client.get("/api/vehicles/lookup/CAG%205124", headers=SERVICE_HEADERS)
    assert json.loads(resp.data)["plate_number"] == "CAG5124"
    table_mock.eq.assert_any_call("plate_number", "CAG5124")


def test_register_for_other_user_requires_admin(client, mock_supabase):
    """A regular user can't register a vehicle on someone else's account."""
    _setup_auth(mock_supabase, role="user")

    with patch("routes_common.supabase", mock_supabase):
        resp = client.post(
            "/api/vehicles",
            data=json.dumps({"plate_number": "CAG 5124", "user_id": 99}),
            content_type="application/json",
            headers={"Authorization": "Bearer test-token"},
        )
    assert resp.status_code == 403
