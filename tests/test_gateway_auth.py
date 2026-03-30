from __future__ import annotations

from fastapi.testclient import TestClient

from services.gateway.app import app


def test_token_issue_and_invoke_list_tools(monkeypatch):
    client = TestClient(app)
    r = client.post("/v1/oauth/token", json={"client_id": "demo", "client_secret": "demo"})
    assert r.status_code == 200
    token = r.json()["access_token"]

    class Resp:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {"tools": []}

    async def fake_get(self, *args, **kwargs):
        return Resp()

    import httpx

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    r2 = client.get("/v1/tools", headers={"authorization": f"Bearer {token}"})
    assert r2.status_code == 200
