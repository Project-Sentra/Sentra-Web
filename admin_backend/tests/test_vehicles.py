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


def test_lookup_vehicle_not_registered(client, mock_supabase):
    """GET /api/vehicles/lookup/:plate for unregistered plate."""
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.limit.return_value = table_mock
    table_mock.execute.return_value = MagicMock(data=[])
    mock_supabase.table.return_value = table_mock

    resp = client.get("/api/vehicles/lookup/WP-UNKNOWN")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["registered"] is False


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

    resp = client.get("/api/vehicles/lookup/WP%20CAB-1234")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["registered"] is True
    assert data["has_subscription"] is False
