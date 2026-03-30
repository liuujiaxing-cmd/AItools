from __future__ import annotations

import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from toolset_core.context import principal_var, request_id_var
from toolset_core.http_errors import toolset_error_response, unexpected_error_response
from toolset_core.logging import configure_logging


logger = logging.getLogger("toolset")


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("x-request-id") or str(uuid.uuid4())
        request_id_var.set(rid)
        start = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            logger.info(
                "request",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status": getattr(locals().get("response"), "status_code", 0),
                    "elapsed_ms": elapsed_ms,
                },
            )
            principal_var.set(None)
            request_id_var.set(None)
        response.headers["x-request-id"] = rid
        return response


def build_app(*, title: str, version: str) -> FastAPI:
    configure_logging()
    app = FastAPI(title=title, version=version)
    app.add_middleware(RequestContextMiddleware)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        from toolset_core.errors import ToolsetError

        if isinstance(exc, ToolsetError):
            return toolset_error_response(request, exc)
        return unexpected_error_response(request, exc)

    @app.get("/healthz")
    async def healthz():
        return {"ok": True}

    return app
