from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import Depends, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from redis.asyncio import Redis

from services.common import build_app
from toolset_core.apikeys import ApiKeyStore
from toolset_core.auth import Principal, issue_jwt, verify_jwt
from toolset_core.config import GatewaySettings
from toolset_core.context import principal_var, request_id_var
from toolset_core.errors import ToolsetError, error_message
from toolset_core.metrics import PrometheusMiddleware, metrics_endpoint
from toolset_core.rate_limit import RateLimitRule, TokenBucketLimiter
from toolset_core.signature import verify_signature
from toolset_core.tracing import setup_tracing


logger = logging.getLogger("toolset.gateway")

settings = GatewaySettings()
if settings.otel_enabled:
    setup_tracing(service_name="gateway", jaeger_endpoint=settings.otel_exporter_jaeger_endpoint)

app = build_app(title="Toolset Gateway", version="1.0.0")
app.add_middleware(PrometheusMiddleware, service_name="gateway")

redis = Redis.from_url(settings.redis_url, decode_responses=True)
limiter = TokenBucketLimiter(redis)
api_keys = ApiKeyStore()


class TokenRequest(BaseModel):
    client_id: str
    client_secret: str


class ApiKeyCreateRequest(BaseModel):
    name: str
    scopes: list[str] = ["tools:invoke", "tools:read"]


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else ""


def enforce_ip_whitelist(request: Request) -> None:
    allowed = {x.strip() for x in settings.gateway_allowed_ips.split(",") if x.strip()}
    ip = client_ip(request)
    if allowed and ip not in allowed:
        raise ToolsetError(
            app_code="3xx.forbidden",
            http_status=403,
            message=error_message("3xx.forbidden"),
            details={"reason": "ip_not_allowed", "ip": ip},
        )


async def enforce_rate_limit(request: Request, principal: Principal | None, api_key_id: str | None) -> None:
    ip = client_ip(request)
    base_key = f"{request.method}:{request.url.path}"
    keys: list[tuple[str, RateLimitRule]] = [
        (f"ip:{ip}:{base_key}", RateLimitRule(capacity=60, refill_per_second=1.0)),
    ]
    if principal:
        keys.append((f"user:{principal.sub}:{base_key}", RateLimitRule(capacity=120, refill_per_second=2.0)))
    if api_key_id:
        keys.append((f"ak:{api_key_id}:{base_key}", RateLimitRule(capacity=120, refill_per_second=2.0)))

    for k, rule in keys:
        try:
            ok = await limiter.allow(k, rule)
        except Exception as exc:
            logger.warning("rate_limit_backend_failed", extra={"error": str(exc)})
            ok = True
        if not ok:
            raise ToolsetError(
                app_code="3xx.rate_limited",
                http_status=429,
                message=error_message("3xx.rate_limited"),
                details={"key": k},
            )


async def authenticate(
    request: Request,
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
) -> Principal | None:
    enforce_ip_whitelist(request)

    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        principal = verify_jwt(
            token=token,
            issuer=settings.gateway_jwt_issuer,
            audience=settings.gateway_jwt_audience,
            secret=settings.gateway_jwt_secret,
        )
        principal_var.set(principal.as_dict())
        await enforce_rate_limit(request, principal, None)
        return principal

    if x_api_key:
        rec = api_keys.resolve(x_api_key)
        if not rec:
            raise ToolsetError(
                app_code="3xx.unauthorized",
                http_status=401,
                message=error_message("3xx.unauthorized"),
                details={"reason": "invalid_api_key"},
            )
        principal = Principal(sub=rec.name, kind="api_key", scopes=rec.scopes, api_key_id=rec.key_id)
        principal_var.set(principal.as_dict())
        await enforce_rate_limit(request, principal, rec.key_id)
        await maybe_verify_request_signature(request, api_key_id=rec.key_id, secret=rec.key_secret)
        return principal

    await enforce_rate_limit(request, None, None)
    return None


async def maybe_verify_request_signature(request: Request, *, api_key_id: str, secret: str) -> None:
    if not settings.gateway_require_signature:
        return
    sig = request.headers.get("x-signature")
    ts = request.headers.get("x-timestamp")
    nonce = request.headers.get("x-nonce")
    if not sig or not ts or not nonce:
        raise ToolsetError(
            app_code="3xx.signature_invalid",
            http_status=401,
            message=error_message("3xx.signature_invalid"),
            details={"reason": "missing_headers"},
        )
    body = await request.body()
    verify_signature(
        secret=secret,
        provided=sig,
        method=request.method,
        path=request.url.path,
        ts=ts,
        nonce=nonce,
        body=body,
    )

    nonce_key = f"nonce:{api_key_id}:{nonce}"
    ok = await redis.set(nonce_key, "1", ex=600, nx=True)
    if not ok:
        raise ToolsetError(
            app_code="3xx.signature_invalid",
            http_status=401,
            message=error_message("3xx.signature_invalid"),
            details={"reason": "replay_detected"},
        )


def require_jwt(principal: Principal | None = Depends(authenticate)) -> Principal:
    if not principal or principal.kind != "jwt":
        raise ToolsetError(
            app_code="3xx.forbidden",
            http_status=403,
            message=error_message("3xx.forbidden"),
            details={"reason": "admin_required"},
        )
    return principal


@app.get("/metrics")
async def metrics():
    return metrics_endpoint()


@app.post("/v1/oauth/token")
async def token(req: TokenRequest):
    if not (req.client_id == "demo" and req.client_secret == "demo"):
        raise ToolsetError(
            app_code="3xx.unauthorized",
            http_status=401,
            message=error_message("3xx.unauthorized"),
            details={"reason": "invalid_client"},
        )
    t = issue_jwt(
        subject=req.client_id,
        issuer=settings.gateway_jwt_issuer,
        audience=settings.gateway_jwt_audience,
        secret=settings.gateway_jwt_secret,
        ttl_seconds=settings.gateway_token_ttl_seconds,
    )
    return {"access_token": t, "token_type": "bearer", "expires_in": settings.gateway_token_ttl_seconds}


@app.post("/v1/apikeys")
async def create_api_key(req: ApiKeyCreateRequest, _: Principal = Depends(require_jwt)):
    return api_keys.create(name=req.name, scopes=req.scopes)


@app.get("/v1/tools")
async def list_tools(_: Principal | None = Depends(authenticate)):
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{settings.runtime_base_url}/v1/tools")
        r.raise_for_status()
        return r.json()


@app.post("/v1/tools/{tool_name}:invoke")
async def invoke_tool(tool_name: str, request: Request, principal: Principal | None = Depends(authenticate)):
    body = await request.body()
    headers: dict[str, str] = {"content-type": request.headers.get("content-type", "application/json")}
    rid = request_id_var.get() or ""
    headers["x-request-id"] = rid
    if principal:
        headers["x-openclaw-user"] = principal.sub
        if principal.api_key_id:
            headers["x-openclaw-apikey-id"] = principal.api_key_id

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{settings.runtime_base_url}/v1/tools/{tool_name}:invoke",
            content=body,
            headers=headers,
        )
        if r.status_code >= 400:
            return JSONResponse(status_code=r.status_code, content=r.json())
        return r.json()


@app.get("/v1/docs/errors")
async def error_docs() -> dict[str, Any]:
    from toolset_core.errors import ERROR_CATALOG

    return {
        "errors": [
            {"code": code, "message": {"zh": msg.zh, "en": msg.en}}
            for code, msg in sorted(ERROR_CATALOG.items())
        ]
    }
