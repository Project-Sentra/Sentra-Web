"""Tests for health and system endpoints."""


def test_options_preflight(client):
    """OPTIONS requests should return 200 for CORS preflight."""
    resp = client.options("/api/facilities")
    assert resp.status_code == 200


def test_unknown_route_returns_404(client):
    """Requesting a non-existent route should return 404."""
    resp = client.get("/api/nonexistent")
    assert resp.status_code == 404
