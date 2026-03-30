from __future__ import annotations

import hashlib
import hmac
import time
from typing import Any

from toolset_core.errors import ToolsetError, error_message


def compute_signature(secret: str, *, method: str, path: str, ts: str, nonce: str, body: bytes) -> str:
    msg = b"\n".join(
        [
            method.upper().encode(),
            path.encode(),
            ts.encode(),
            nonce.encode(),
            hashlib.sha256(body).hexdigest().encode(),
        ]
    )
    return hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()


def verify_signature(
    *,
    secret: str,
    provided: str,
    method: str,
    path: str,
    ts: str,
    nonce: str,
    body: bytes,
    max_skew_seconds: int = 300,
) -> None:
    try:
        now = int(time.time())
        ts_i = int(ts)
        if abs(now - ts_i) > max_skew_seconds:
            raise ToolsetError(
                app_code="3xx.signature_invalid",
                http_status=401,
                message=error_message("3xx.signature_invalid"),
                details={"reason": "timestamp_skew"},
            )
    except ValueError as exc:
        raise ToolsetError(
            app_code="3xx.signature_invalid",
            http_status=401,
            message=error_message("3xx.signature_invalid"),
            details={"reason": "invalid_timestamp"},
        ) from exc

    expected = compute_signature(secret, method=method, path=path, ts=ts, nonce=nonce, body=body)
    if not hmac.compare_digest(expected, provided):
        raise ToolsetError(
            app_code="3xx.signature_invalid",
            http_status=401,
            message=error_message("3xx.signature_invalid"),
            details={"reason": "mismatch"},
        )

