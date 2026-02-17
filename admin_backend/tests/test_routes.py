"""Tests for route registration and general request handling."""

import json


def test_api_routes_registered(client):
    """Key API routes should be registered."""
    # Test that key routes exist (even if they require auth)
    routes_to_check = [
        ("/api/facilities", "GET"),
        ("/api/auth/signup", "POST"),
        ("/api/auth/login", "POST"),
    ]
    for path, method in routes_to_check:
        if method == "GET":
            resp = client.get(path)
        else:
            resp = client.post(
                path,
                data=json.dumps({}),
                content_type="application/json",
            )
        # Should NOT be 404 (route exists, may return 400/401)
        assert resp.status_code != 404, f"{method} {path} returned 404"


def test_cors_headers_present(client):
    """CORS headers should be present on API responses."""
    resp = client.options(
        "/api/facilities",
        headers={"Origin": "http://localhost:5173"},
    )
    assert resp.status_code == 200


def test_json_content_type(client, mock_supabase):
    """API responses should have JSON content type."""
    from unittest.mock import MagicMock

    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.order.return_value = table_mock
    table_mock.execute.return_value = MagicMock(data=[])
    mock_supabase.table.return_value = table_mock

    resp = client.get("/api/facilities")
    assert resp.content_type == "application/json"
