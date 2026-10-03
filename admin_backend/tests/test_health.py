"""Tests for health and system endpoints."""


def test_options_preflight(client):
    """OPTIONS requests should return 200 for CORS preflight."""
    resp = client.options("/api/facilities")
    assert resp.status_code == 200


def test_health_is_public(client):
    """GET /api/health is used by the Docker HEALTHCHECK and must not need auth."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "healthy"


def test_system_reset_requires_admin(client):
    """The destructive reset endpoint must reject anonymous calls."""
    resp = client.post("/api/system/reset")
    assert resp.status_code == 401


def test_unknown_route_returns_404(client):
    """Requesting a non-existent route should return 404."""
    resp = client.get("/api/nonexistent")
    assert resp.status_code == 404
