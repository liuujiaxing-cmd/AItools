from __future__ import annotations

import logging
from typing import Any

from fastapi import Body
from pydantic import BaseModel
from sqlalchemy import JSON, Boolean, Column, Integer, String, Text, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from services.common import build_app
from toolset_core.config import RegistrySettings
from toolset_core.metrics import PrometheusMiddleware, metrics_endpoint
from toolset_core.tracing import setup_tracing


logger = logging.getLogger("toolset.registry")

settings = RegistrySettings()
if settings.otel_enabled:
    setup_tracing(service_name="registry", jaeger_endpoint=settings.otel_exporter_jaeger_endpoint)

app = build_app(title="Toolset Registry", version="1.0.0")
app.add_middleware(PrometheusMiddleware, service_name="registry")

Base = declarative_base()


class ToolRecord(Base):
    __tablename__ = "tools"

    id = Column(Integer, primary_key=True)
    name = Column(String(128), index=True, nullable=False)
    version = Column(String(64), nullable=False)
    description = Column(Text, nullable=False)
    entrypoint = Column(String(256), nullable=False)
    dependencies = Column(JSON, nullable=False, default=list)
    config_schema = Column(JSON, nullable=False, default=dict)
    enabled = Column(Boolean, nullable=False, default=True)


engine = create_async_engine(settings.registry_db_url, future=True)
Session = async_sessionmaker(engine, expire_on_commit=False)


@app.on_event("startup")
async def _startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/metrics")
async def metrics():
    return metrics_endpoint()


class ToolUpsertRequest(BaseModel):
    name: str
    version: str
    description: str
    entrypoint: str
    dependencies: list[str] = []
    config_schema: dict[str, Any] = {}
    enabled: bool = True


@app.post("/v1/tools")
async def upsert_tool(req: ToolUpsertRequest = Body(...)):
    async with Session() as session:
        existing = await session.execute(
            select(ToolRecord).where(ToolRecord.name == req.name, ToolRecord.version == req.version)
        )
        rec = existing.scalar_one_or_none()
        if rec is None:
            rec = ToolRecord(
                name=req.name,
                version=req.version,
                description=req.description,
                entrypoint=req.entrypoint,
                dependencies=req.dependencies,
                config_schema=req.config_schema,
                enabled=req.enabled,
            )
            session.add(rec)
        else:
            rec.description = req.description
            rec.entrypoint = req.entrypoint
            rec.dependencies = req.dependencies
            rec.config_schema = req.config_schema
            rec.enabled = req.enabled
        await session.commit()
        return {"ok": True}


@app.get("/v1/tools")
async def list_tools():
    async with Session() as session:
        rows = await session.execute(select(ToolRecord))
        items = []
        for r in rows.scalars().all():
            items.append(
                {
                    "name": r.name,
                    "version": r.version,
                    "description": r.description,
                    "entrypoint": r.entrypoint,
                    "dependencies": r.dependencies,
                    "config_schema": r.config_schema,
                    "enabled": r.enabled,
                }
            )
        return {"tools": items}


@app.get("/v1/tools/{tool_name}")
async def get_tool(tool_name: str):
    async with Session() as session:
        rows = await session.execute(select(ToolRecord).where(ToolRecord.name == tool_name))
        items = []
        for r in rows.scalars().all():
            items.append(
                {
                    "name": r.name,
                    "version": r.version,
                    "description": r.description,
                    "entrypoint": r.entrypoint,
                    "dependencies": r.dependencies,
                    "config_schema": r.config_schema,
                    "enabled": r.enabled,
                }
            )
        return {"tools": items}

