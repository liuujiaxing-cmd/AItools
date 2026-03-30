from __future__ import annotations

import secrets
from dataclasses import dataclass
from typing import Any


@dataclass
class ApiKeyRecord:
    key_id: str
    key_secret: str
    name: str
    enabled: bool
    scopes: list[str]


class ApiKeyStore:
    def __init__(self):
        self._by_id: dict[str, ApiKeyRecord] = {}
        self._by_public: dict[str, str] = {}

        demo = self.create(name="demo", scopes=["tools:invoke", "tools:read"])
        self._by_public[demo["api_key"]] = demo["api_key_id"]

    def create(self, *, name: str, scopes: list[str]) -> dict[str, Any]:
        key_id = secrets.token_hex(8)
        public = "ak_" + secrets.token_urlsafe(16)
        secret = "sk_" + secrets.token_urlsafe(32)
        self._by_id[key_id] = ApiKeyRecord(
            key_id=key_id, key_secret=secret, name=name, enabled=True, scopes=scopes
        )
        self._by_public[public] = key_id
        return {"api_key_id": key_id, "api_key": public, "api_secret": secret, "name": name, "scopes": scopes}

    def resolve(self, api_key: str) -> ApiKeyRecord | None:
        key_id = self._by_public.get(api_key)
        if not key_id:
            return None
        rec = self._by_id.get(key_id)
        if not rec or not rec.enabled:
            return None
        return rec

