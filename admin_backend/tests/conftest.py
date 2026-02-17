"""
Shared fixtures for backend tests.
Mocks the Supabase client so tests run without a real database.
"""

import os
import sys
from unittest.mock import MagicMock, patch

import pytest

# Set dummy env vars BEFORE importing app
os.environ["SUPABASE_URL"] = "https://test.supabase.co"
os.environ["SUPABASE_KEY"] = "test-key-12345"

# Add parent dir to path so `from app import ...` works
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def make_chainable_mock(return_data=None):
    """Create a mock that supports chained calls like .select().eq().execute()."""
    mock = MagicMock()
    mock.select.return_value = mock
    mock.insert.return_value = mock
    mock.update.return_value = mock
    mock.delete.return_value = mock
    mock.eq.return_value = mock
    mock.neq.return_value = mock
    mock.order.return_value = mock
    mock.limit.return_value = mock
    mock.in_.return_value = mock
    mock.gte.return_value = mock
    mock.lte.return_value = mock
    resp = MagicMock()
    resp.data = return_data if return_data is not None else []
    mock.execute.return_value = resp
    return mock


# Patch create_client BEFORE importing app so routes get registered on the app
_mock_supabase_client = MagicMock()
_mock_supabase_client.table.return_value = make_chainable_mock()
_mock_supabase_client.auth = MagicMock()

with patch("supabase.create_client", return_value=_mock_supabase_client):
    import app as app_module  # noqa: E402


# Also patch the references in all route modules
_route_modules = [
    "routes_common", "routes_auth", "routes_users", "routes_vehicles",
    "routes_facilities", "routes_spots", "routes_reservations",
    "routes_sessions", "routes_wallet", "routes_subscriptions",
    "routes_cameras", "routes_gates", "routes_detections",
    "routes_notifications", "routes_dashboard", "routes_system",
    "routes_compat",
]


@pytest.fixture(autouse=True)
def _patch_supabase():
    """Ensure all route modules use the same mock supabase."""
    # Reset mock state
    _mock_supabase_client.table.reset_mock()
    _mock_supabase_client.table.return_value = make_chainable_mock()
    _mock_supabase_client.table.side_effect = None
    _mock_supabase_client.auth.reset_mock()

    # Patch supabase in all route modules
    patches = []
    for mod_name in _route_modules:
        if mod_name in sys.modules:
            p = patch(f"{mod_name}.supabase", _mock_supabase_client)
            p.start()
            patches.append(p)

    yield

    for p in patches:
        p.stop()


@pytest.fixture()
def mock_supabase():
    """Provide the mocked Supabase client."""
    return _mock_supabase_client


@pytest.fixture()
def client():
    """Flask test client."""
    app_module.app.config["TESTING"] = True
    with app_module.app.test_client() as test_client:
        yield test_client
