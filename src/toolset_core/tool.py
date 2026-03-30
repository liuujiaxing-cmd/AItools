from __future__ import annotations

from typing import Protocol

from toolset_core.models import ExecutionContext, ToolMetadata


class Tool(Protocol):
    def metadata(self) -> ToolMetadata: ...

    async def invoke(self, input: dict, context: ExecutionContext) -> dict: ...

