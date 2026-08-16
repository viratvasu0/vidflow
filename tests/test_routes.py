import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

os.environ.setdefault("MEDIA_PROCESSOR_PROVIDER", "mock")

from app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config.update(TESTING=True)
    with app.test_client() as client:
        yield client


def test_health_endpoint(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert data["status"] == "ok"


def test_index_page_loads(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert b"VidFlow" in resp.data or b"VIDFLOW" in resp.data


def test_analyze_missing_url_returns_400(client):
    resp = client.post("/api/analyze", json={})
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["success"] is False


def test_analyze_invalid_url_returns_400(client):
    resp = client.post("/api/analyze", json={"url": "not-a-url"})
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["success"] is False


def test_analyze_blocked_platform_returns_400(client):
    resp = client.post("/api/analyze", json={"url": "https://www.youtube.com/watch?v=abc"})
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["success"] is False
    assert "platform" in data["error"].lower()


def test_analyze_requires_json_body(client):
    resp = client.post("/api/analyze", data="not json", content_type="text/plain")
    assert resp.status_code == 400


def test_download_without_prior_analyze_still_validates_url(client):
    resp = client.post("/api/download", json={"url": "not-a-url", "format_id": "fmt_0"})
    assert resp.status_code == 400


def test_status_for_unknown_job_returns_404(client):
    resp = client.get("/api/status/" + "a" * 32)
    assert resp.status_code == 404


def test_status_for_malformed_job_id_returns_404(client):
    resp = client.get("/api/status/bad id")
    assert resp.status_code == 404


def test_unknown_route_returns_json_404_for_api(client):
    resp = client.get("/api/does-not-exist")
    assert resp.status_code == 404
    data = resp.get_json()
    assert data["success"] is False
