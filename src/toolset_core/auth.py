from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import jwt

from toolset_core.errors import ToolsetError, error_message


@dataclass(frozen=True)
class Principal:
    sub: str
    kind: str
    scopes: list[str]
    api_key_id: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {"sub": self.sub, "kind": self.kind, "scopes": self.scopes, "api_key_id": self.api_key_id}


def issue_jwt(*, subject: str, issuer: str, audience: str, secret: str, ttl_seconds: int) -> str:
    now = int(time.time())
    payload = {
        "iss": issuer,
        "aud": audience,
        "sub": subject,
        "iat": now,
        "exp": now + int(ttl_seconds),
        "scope": "tools:invoke tools:read",
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def verify_jwt(*, token: str, issuer: str, audience: str, secret: str) -> Principal:
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"], issuer=issuer, audience=audience)
        scopes = str(payload.get("scope", "")).split()
        sub = str(payload.get("sub"))
        if not sub:
            raise ValueError("missing sub")
        return Principal(sub=sub, kind="jwt", scopes=scopes)
    except Exception as exc:
        raise ToolsetError(
            app_code="3xx.unauthorized",
            http_status=401,
            message=error_message("3xx.unauthorized"),
            details={"reason": "invalid_token"},
        ) from exc

