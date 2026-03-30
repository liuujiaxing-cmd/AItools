from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from pathlib import Path
from typing import Any

from fastapi import Body, Header
from pydantic import BaseModel
from redis.asyncio import Redis

from services.common import build_app
from toolset_core.config import RuntimeSettings
from toolset_core.context import request_id_var
from toolset_core.cache import TTLCache
from toolset_core.metrics import PrometheusMiddleware, metrics_endpoint
from toolset_core.models import ExecutionContext, ToolInvokeRequest, ToolInvokeResponse
from toolset_core.tool_manager import ToolManager
from toolset_core.tracing import setup_tracing


logger = logging.getLogger("toolset.runtime")

settings = RuntimeSettings()
if settings.otel_enabled:
    setup_tracing(service_name="runtime", jaeger_endpoint=settings.otel_exporter_jaeger_endpoint)

app = build_app(title="Toolset Runtime", version="1.0.0")
app.add_middleware(PrometheusMiddleware, service_name="runtime")

manager = ToolManager(settings.tools_dir)
redis = Redis.from_url(settings.redis_url, decode_responses=True)
local_cache = TTLCache(max_items=4096)


@app.on_event("startup")
async def _startup():
    await manager.reload()

    async def _watch():
        while True:
            await manager.hot_reload_if_changed()
            await asyncio.sleep(0.5)

    asyncio.create_task(_watch())


@app.get("/metrics")
async def metrics():
    return metrics_endpoint()


@app.get("/v1/tools")
async def list_tools():
    return {"tools": [t.dict() for t in manager.list_tools()]}


@app.get("/v1/tools/{tool_name}")
async def get_tool(tool_name: str):
    t = manager.get_tool(tool_name)
    if not t:
        from toolset_core.errors import ToolsetError, error_message

        raise ToolsetError(
            app_code="2xx.tool_not_found",
            http_status=404,
            message=error_message("2xx.tool_not_found"),
            details={"tool": tool_name},
        )
    return {"tool": {"metadata": t.metadata.dict(), "status": t.status, "last_error": t.last_error}}


@app.post("/v1/tools/reload")
async def reload_tools():
    tools = await manager.reload()
    return {"tools": [t.dict() for t in tools]}


class RegisterToolRequest(BaseModel):
    file_name: str
    source_code: str


@app.post("/v1/tools/register")
async def register_tool(req: RegisterToolRequest, x_openclaw_user: str | None = Header(default=None)):
    tools_dir = Path(settings.tools_dir)
    tools_dir.mkdir(parents=True, exist_ok=True)
    target = tools_dir / req.file_name
    if not target.name.endswith(".py") or target.name.startswith("_"):
        from toolset_core.errors import ToolsetError, error_message

        raise ToolsetError(
            app_code="1xx.invalid_request",
            http_status=400,
            message=error_message("1xx.invalid_request"),
            details={"reason": "invalid_file_name"},
        )
    target.write_text(req.source_code, encoding="utf-8")
    await manager.reload()
    return {"ok": True, "file": target.name, "by": x_openclaw_user}


@app.post("/v1/tools/{tool_name}:invoke")
async def invoke_tool(
    tool_name: str,
    req: ToolInvokeRequest = Body(...),
    x_openclaw_user: str | None = Header(default=None),
    x_openclaw_apikey_id: str | None = Header(default=None),
):
    rid = request_id_var.get() or ""
    ctx = req.context
    ctx.request_id = rid
    ctx.user_id = x_openclaw_user or ctx.user_id
    ctx.api_key_id = x_openclaw_apikey_id or ctx.api_key_id

    tool = manager.get_tool(tool_name)
    ttl = 0
    if tool and tool.metadata.cache_ttl_seconds is not None:
        ttl = int(tool.metadata.cache_ttl_seconds)
    elif settings.tool_cache_default_ttl_seconds:
        ttl = int(settings.tool_cache_default_ttl_seconds)

    cache_key = ""
    if ttl > 0:
        payload = json.dumps(req.input, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        cache_key = f"toolcache:{tool_name}:{digest}"
        cached = local_cache.get(cache_key)
        if cached is not None:
            return ToolInvokeResponse(output=cached, meta={"tool": tool_name, "request_id": rid, "cache": "local"}).dict()
        try:
            cached_redis = await redis.get(cache_key)
        except Exception:
            cached_redis = None
        if cached_redis:
            val = json.loads(cached_redis)
            local_cache.set(cache_key, val, ttl_seconds=ttl)
            return ToolInvokeResponse(output=val, meta={"tool": tool_name, "request_id": rid, "cache": "redis"}).dict()

    result = await manager.invoke(tool_name, req.input, ctx)
    if ttl > 0 and cache_key:
        local_cache.set(cache_key, result, ttl_seconds=ttl)
        try:
            await redis.set(cache_key, json.dumps(result, ensure_ascii=False), ex=ttl)
        except Exception:
            pass
    return ToolInvokeResponse(output=result, meta={"tool": tool_name, "request_id": rid}).dict()
