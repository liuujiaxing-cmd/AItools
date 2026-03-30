from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ToolStatus(str, Enum):
    loaded = "loaded"
    ready = "ready"
    failed = "failed"


class ExecutionContext(BaseModel):
    trace_id: str | None = None
    user_id: str | None = None
    api_key_id: str | None = None
    request_id: str | None = None
    locale: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict)


class ToolInvokeRequest(BaseModel):
    input: dict[str, Any] = Field(default_factory=dict)
    context: ExecutionContext = Field(default_factory=ExecutionContext)
    options: dict[str, Any] = Field(default_factory=dict)


class ToolInvokeResponse(BaseModel):
    output: dict[str, Any] = Field(default_factory=dict)
    meta: dict[str, Any] = Field(default_factory=dict)


class ToolMetadata(BaseModel):
    name: str
    version: str
    description: str
    input_schema: dict[str, Any] = Field(default_factory=dict)
    output_schema: dict[str, Any] = Field(default_factory=dict)
    cache_ttl_seconds: int | None = None
    tags: list[str] = Field(default_factory=list)


class ToolInfo(BaseModel):
    metadata: ToolMetadata
    status: ToolStatus
    last_error: str | None = None

