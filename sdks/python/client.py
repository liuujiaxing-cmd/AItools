from __future__ import annotations

import httpx


class ToolsetClient:
    def __init__(self, base_url: str, *, token: str | None = None, api_key: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.api_key = api_key

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {"content-type": "application/json"}
        if self.token:
            headers["authorization"] = f"Bearer {self.token}"
        if self.api_key:
            headers["x-api-key"] = self.api_key
        return headers

    def list_tools(self) -> dict:
        r = httpx.get(f"{self.base_url}/v1/tools", headers=self._headers(), timeout=10)
        r.raise_for_status()
        return r.json()

    def invoke(self, tool_name: str, *, input: dict, context: dict | None = None, options: dict | None = None) -> dict:
        payload = {"input": input, "context": context or {}, "options": options or {}}
        r = httpx.post(
            f"{self.base_url}/v1/tools/{tool_name}:invoke",
            headers=self._headers(),
            json=payload,
            timeout=60,
        )
        r.raise_for_status()
        return r.json()

