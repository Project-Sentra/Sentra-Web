"""
Tests for POST /api/auth/social-login (Google sign-in).

The users table is queried several times per request (auth lookup by
auth_user_id, then by email), so each test scripts the execute() results
in call order.
"""

from unittest.mock import MagicMock

AUTH = {"Authorization": "Bearer google-token"}


def _auth_user(confirmed=True, email="driver@gmail.com"):
    return MagicMock(
        id="auth-google-1",
        email=email,
        email_confirmed_at="2026-10-03T10:00:00Z" if confirmed else None,
        user_metadata={"full_name": "Google Driver", "avatar_url": "http://pic"},
    )


def _tables(mock_supabase, users_results, wallets=None):
    """users.execute() returns users_results in order; returns the table mocks."""
    mocks = {}

    def table(name):
        if name not in mocks:
            m = MagicMock()
            for method in ("select", "insert", "update", "eq", "limit"):
                getattr(m, method).return_value = m
            if name == "users":
                m.execute.side_effect = [MagicMock(data=d) for d in users_results]
            else:
                m.execute.return_value = MagicMock(data=wallets or [])
            mocks[name] = m
        return mocks[name]

    mock_supabase.table.side_effect = table
    return mocks


def test_social_login_requires_token(client):
    assert client.post("/api/auth/social-login").status_code == 401


def test_first_google_login_creates_user_with_user_role(client, mock_supabase):
    mock_supabase.auth.get_user.return_value = MagicMock(user=_auth_user())
    created = {"id": 7, "email": "driver@gmail.com", "role": "user"}
    mocks = _tables(mock_supabase, [[], [], [created]])

    resp = client.post("/api/auth/social-login", headers=AUTH)

    assert resp.status_code == 201
    assert resp.get_json()["user"]["role"] == "user"
    inserted = mocks["users"].insert.call_args[0][0]
    assert inserted["role"] == "user"
    assert inserted["auth_user_id"] == "auth-google-1"
    mocks["user_wallets"].insert.assert_called_once()


def test_existing_linked_user_logs_in(client, mock_supabase):
    mock_supabase.auth.get_user.return_value = MagicMock(user=_auth_user())
    admin = {
        "id": 3,
        "email": "driver@gmail.com",
        "role": "admin",
        "auth_user_id": "auth-google-1",
        "is_active": True,
    }
    mocks = _tables(mock_supabase, [[admin]])

    resp = client.post("/api/auth/social-login", headers=AUTH)

    assert resp.status_code == 200
    assert resp.get_json()["user"]["role"] == "admin"
    mocks["users"].insert.assert_not_called()


def test_unlinked_row_with_same_verified_email_is_linked(client, mock_supabase):
    """A row created by the mobile app (no auth_user_id) is linked, not duplicated."""
    mock_supabase.auth.get_user.return_value = MagicMock(user=_auth_user())
    row = {"id": 5, "email": "driver@gmail.com", "role": "user", "auth_user_id": None}
    linked = dict(row, auth_user_id="auth-google-1")
    mocks = _tables(mock_supabase, [[], [row], [linked]])

    resp = client.post("/api/auth/social-login", headers=AUTH)

    assert resp.status_code == 200
    assert resp.get_json()["user"]["db_id"] == 5
    mocks["users"].update.assert_called_once_with({"auth_user_id": "auth-google-1"})
    mocks["users"].insert.assert_not_called()


def test_unverified_email_cannot_claim_existing_row(client, mock_supabase):
    mock_supabase.auth.get_user.return_value = MagicMock(
        user=_auth_user(confirmed=False)
    )
    row = {"id": 5, "email": "driver@gmail.com", "role": "admin", "auth_user_id": None}
    mocks = _tables(mock_supabase, [[], [row]])

    resp = client.post("/api/auth/social-login", headers=AUTH)

    assert resp.status_code == 403
    mocks["users"].update.assert_not_called()


def test_email_linked_to_another_account_is_rejected(client, mock_supabase):
    mock_supabase.auth.get_user.return_value = MagicMock(user=_auth_user())
    row = {"id": 5, "email": "driver@gmail.com", "auth_user_id": "someone-else"}
    mocks = _tables(mock_supabase, [[], [row]])

    resp = client.post("/api/auth/social-login", headers=AUTH)

    assert resp.status_code == 409
    mocks["users"].update.assert_not_called()


def test_deactivated_user_is_blocked(client, mock_supabase):
    mock_supabase.auth.get_user.return_value = MagicMock(user=_auth_user())
    row = {
        "id": 3,
        "email": "driver@gmail.com",
        "auth_user_id": "auth-google-1",
        "is_active": False,
    }
    _tables(mock_supabase, [[row]])

    assert client.post("/api/auth/social-login", headers=AUTH).status_code == 403
