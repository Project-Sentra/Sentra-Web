"""Tests for facility management endpoints."""

import json
from unittest.mock import MagicMock, patch


def test_get_facilities_returns_list(client, mock_supabase):
    """GET /api/facilities should return a list of facilities."""
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.order.return_value = table_mock
    table_mock.execute.return_value = MagicMock(data=[])
    mock_supabase.table.return_value = table_mock

    resp = client.get("/api/facilities")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert "facilities" in data
    assert isinstance(data["facilities"], list)


def test_get_facilities_with_occupancy(client, mock_supabase):
    """GET /api/facilities should include occupancy counts."""
    facility_data = [{"id": 1, "name": "Test Lot", "is_active": True}]
    spots_data = [
        {"is_occupied": True, "is_reserved": False},
        {"is_occupied": False, "is_reserved": True},
        {"is_occupied": False, "is_reserved": False},
    ]

    call_count = [0]

    def table_side_effect(name):
        mock = MagicMock()
        mock.select.return_value = mock
        mock.eq.return_value = mock
        mock.order.return_value = mock
        mock.limit.return_value = mock
        if name == "facilities":
            mock.execute.return_value = MagicMock(data=facility_data)
        elif name == "parking_spots":
            mock.execute.return_value = MagicMock(data=spots_data)
        return mock

    mock_supabase.table.side_effect = table_side_effect

    resp = client.get("/api/facilities")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert len(data["facilities"]) == 1
    f = data["facilities"][0]
    assert f["total_spots"] == 3
    assert f["occupied_spots"] == 1
    assert f["reserved_spots"] == 1
    assert f["available_spots"] == 1


def test_create_facility_missing_name(client, mock_supabase):
    """POST /api/facilities without name should return 400."""
    # Mock admin auth
    mock_user = MagicMock()
    mock_user.id = "admin-uuid"

    mock_auth_resp = MagicMock()
    mock_auth_resp.user = mock_user
    mock_supabase.auth.get_user.return_value = mock_auth_resp

    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.limit.return_value = table_mock
    table_mock.execute.return_value = MagicMock(
        data=[{"id": 1, "role": "admin", "auth_user_id": "admin-uuid"}]
    )
    mock_supabase.table.return_value = table_mock

    with patch("routes_common.supabase", mock_supabase):
        resp = client.post(
            "/api/facilities",
            data=json.dumps({}),
            content_type="application/json",
            headers={"Authorization": "Bearer fake-admin-token"},
        )
    assert resp.status_code == 400
    assert b"Facility name is required" in resp.data


def test_get_facility_not_found(client, mock_supabase):
    """GET /api/facilities/:id for non-existent facility should return 404."""
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.limit.return_value = table_mock
    table_mock.execute.return_value = MagicMock(data=[])
    mock_supabase.table.return_value = table_mock

    resp = client.get("/api/facilities/999")
    assert resp.status_code == 404
    assert b"not found" in resp.data
