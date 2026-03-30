from __future__ import annotations

import asyncio
import importlib
import importlib.util
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from toolset_core.errors import ToolsetError
from toolset_core.models import ExecutionContext, ToolInfo, ToolMetadata, ToolStatus
from toolset_core.tool import Tool
from toolset_core.validation import validate_jsonschema


@dataclass
class LoadedTool:
    name: str
    module_path: Path
    module_name: str
    tool: Tool
    metadata: ToolMetadata
    status: ToolStatus
    last_error: str | None = None
    mtime: float | None = None


class ToolManager:
    def __init__(self, tools_dir: str):
        self.tools_dir = Path(tools_dir)
        self._tools: dict[str, LoadedTool] = {}
        self._lock = asyncio.Lock()

    def list_tools(self) -> list[ToolInfo]:
        items: list[ToolInfo] = []
        for t in sorted(self._tools.values(), key=lambda x: x.name):
            items.append(
                ToolInfo(metadata=t.metadata, status=t.status, last_error=t.last_error)
            )
        return items

    def get_tool(self, name: str) -> LoadedTool | None:
        return self._tools.get(name)

    async def reload(self) -> list[ToolInfo]:
        async with self._lock:
            self._tools.clear()
            self._load_all_from_dir()
        return self.list_tools()

    async def hot_reload_if_changed(self) -> None:
        async with self._lock:
            changed = False
            for file_path in self._iter_tool_files():
                mtime = file_path.stat().st_mtime
                existing = next((t for t in self._tools.values() if t.module_path == file_path), None)
                if existing is None or (existing.mtime and mtime > existing.mtime):
                    changed = True
            if changed:
                self._tools.clear()
                self._load_all_from_dir()

    async def invoke(self, name: str, input: dict[str, Any], context: ExecutionContext) -> dict[str, Any]:
        tool = self._tools.get(name)
        if not tool or tool.status != ToolStatus.ready:
            raise ToolsetError(
                app_code="2xx.tool_not_found",
                http_status=404,
                message=self._msg("2xx.tool_not_found"),
                details={"tool": name},
            )
        try:
            validate_jsonschema(schema=tool.metadata.input_schema, data=input)
            return await tool.tool.invoke(input, context)
        except ToolsetError:
            raise
        except Exception as exc:
            raise ToolsetError(
                app_code="2xx.tool_invoke_failed",
                http_status=500,
                message=self._msg("2xx.tool_invoke_failed"),
                details={"tool": name, "error": str(exc)},
            ) from exc

    def _iter_tool_files(self) -> list[Path]:
        if not self.tools_dir.exists():
            return []
        return [p for p in self.tools_dir.glob("*.py") if p.is_file() and not p.name.startswith("_")]

    def _load_all_from_dir(self) -> None:
        self.tools_dir.mkdir(parents=True, exist_ok=True)
        for file_path in self._iter_tool_files():
            self._load_one(file_path)

    def _load_one(self, file_path: Path) -> None:
        module_key = f"toolset_plugins.{file_path.stem}.{int(time.time()*1000)}"
        spec = importlib.util.spec_from_file_location(module_key, file_path)
        if not spec or not spec.loader:
            return
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_key] = module
        try:
            spec.loader.exec_module(module)
            tool_obj = getattr(module, "TOOL", None)
            if tool_obj is None:
                raise ValueError("TOOL not found")
            metadata = tool_obj.metadata()
            self._tools[metadata.name] = LoadedTool(
                name=metadata.name,
                module_path=file_path,
                module_name=module_key,
                tool=tool_obj,
                metadata=metadata,
                status=ToolStatus.ready,
                last_error=None,
                mtime=file_path.stat().st_mtime,
            )
        except Exception as exc:
            name_guess = file_path.stem
            metadata = ToolMetadata(
                name=name_guess,
                version="0.0.0",
                description="failed to load",
                input_schema={},
                output_schema={},
            )
            self._tools[name_guess] = LoadedTool(
                name=name_guess,
                module_path=file_path,
                module_name=module_key,
                tool=self._failed_tool(name_guess, str(exc)),
                metadata=metadata,
                status=ToolStatus.failed,
                last_error=str(exc),
                mtime=file_path.stat().st_mtime,
            )

    def _failed_tool(self, name: str, err: str) -> Tool:
        from toolset_core.errors import error_message

        msg = error_message("2xx.tool_load_failed")

        class Failed:
            def metadata(self) -> ToolMetadata:
                return ToolMetadata(
                    name=name,
                    version="0.0.0",
                    description="failed to load",
                    input_schema={},
                    output_schema={},
                )

            async def invoke(self, input: dict, context: ExecutionContext) -> dict:
                raise ToolsetError(
                    app_code="2xx.tool_load_failed",
                    http_status=500,
                    message=msg,
                    details={"tool": name, "error": err},
                )

        return Failed()  # type: ignore[return-value]

    @staticmethod
    def _msg(code: str):
        from toolset_core.errors import error_message

        return error_message(code)
