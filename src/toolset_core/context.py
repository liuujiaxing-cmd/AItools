from __future__ import annotations

import contextvars

request_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("request_id", default=None)
principal_var: contextvars.ContextVar[dict | None] = contextvars.ContextVar("principal", default=None)

