"""Tests for authentication endpoints."""

import json
from unittest.mock import MagicMock, patch


def test_signup_missing_email(client):
    """Signup without email should return 400."""
    resp = client.post(
        "/api/auth/signup",
        data=json.dumps({"password": "test123"}),
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert b"Email and password are required" in resp.data


def test_signup_missing_password(client):
    """Signup without password should return 400."""
    resp = client.post(
        "/api/auth/signup",
        data=json.dumps({"email": "test@test.com"}),
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert b"Email and password are required" in resp.data


def test_signup_short_password(client):
    """Signup with password < 6 chars should return 400."""
    resp = client.post(
        "/api/auth/signup",
        data=json.dumps({"email": "test@test.com", "password": "12345"}),
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert b"at least 6 characters" in resp.data


def test_signup_invalid_role(client):
    """Signup with invalid role should return 400."""
    resp = client.post(
        "/api/auth/signup",
        data=json.dumps(
            {
                "email": "test@test.com",
                "password": "test123",
                "role": "superadmin",
            }
        ),
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert b"role must be admin, user, or operator" in resp.data


def test_signup_success(client, mock_supabase):
    """Successful signup should return 201."""
    mock_user = MagicMock()
    mock_user.id = "auth-uuid-123"
    mock_response = MagicMock()
    mock_response.user = mock_user
    mock_supabase.auth.sign_up.return_value = mock_response

    # Mock table inserts
    table_mock = MagicMock()
    table_mock.insert.return_value = table_mock
    table_mock.execute.return_value = MagicMock(
        data=[{"id": 1, "email": "test@test.com"}]
    )
    mock_supabase.table.return_value = table_mock

    resp = client.post(
        "/api/auth/signup",
        data=json.dumps(
            {
                "email": "test@test.com",
                "password": "test123456",
                "full_name": "Test User",
            }
        ),
        content_type="application/json",
    )
    assert resp.status_code == 201
    data = json.loads(resp.data)
    assert "user_id" in data


def test_login_missing_fields(client):
    """Login without email/password should return 400."""
    resp = client.post(
        "/api/auth/login",
        data=json.dumps({}),
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert b"Email and password are required" in resp.data


def test_login_success(client, mock_supabase):
    """Successful login should return 200 with tokens."""
    mock_user = MagicMock()
    mock_user.id = "auth-uuid-123"
    mock_user.email = "test@test.com"

    mock_session = MagicMock()
    mock_session.access_token = "jwt-access-token"
    mock_session.refresh_token = "jwt-refresh-token"

    mock_response = MagicMock()
    mock_response.user = mock_user
    mock_response.session = mock_session
    mock_supabase.auth.sign_in_with_password.return_value = mock_response

    # Mock user lookup
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.limit.return_value = table_mock
    table_mock.execute.return_value = MagicMock(
        data=[
            {
                "id": 1,
                "email": "test@test.com",
                "full_name": "Test",
                "phone": "",
                "role": "user",
            }
        ]
    )
    mock_supabase.table.return_value = table_mock

    resp = client.post(
        "/api/auth/login",
        data=json.dumps({"email": "test@test.com", "password": "test123456"}),
        content_type="application/json",
    )
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == "test@test.com"


def test_protected_endpoint_no_token(client):
    """Accessing a protected endpoint without token should return 401."""
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401
    assert b"No authorization token" in resp.data
