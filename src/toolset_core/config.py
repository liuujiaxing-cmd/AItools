from __future__ import annotations

from pydantic import BaseSettings


class CommonSettings(BaseSettings):
    env: str = "dev"
    redis_url: str = "redis://localhost:6379/0"
    otel_enabled: bool = False
    otel_service_name: str = "toolset"
    otel_exporter_jaeger_endpoint: str = "http://localhost:14268/api/traces"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


class GatewaySettings(CommonSettings):
    gateway_jwt_issuer: str = "toolset"
    gateway_jwt_audience: str = "openclaw"
    gateway_jwt_secret: str = "change-me"
    gateway_token_ttl_seconds: int = 3600

    gateway_allowed_ips: str = "127.0.0.1,::1"
    gateway_require_signature: bool = False

    runtime_base_url: str = "http://localhost:8081"
    registry_base_url: str = "http://localhost:8082"


class RuntimeSettings(CommonSettings):
    tools_dir: str = "src/tools"
    registry_base_url: str = "http://localhost:8082"
    tool_execution_mode: str = "in_process"
    tool_cache_default_ttl_seconds: int = 0


class RegistrySettings(CommonSettings):
    registry_db_url: str = "sqlite+aiosqlite:///./registry.db"
