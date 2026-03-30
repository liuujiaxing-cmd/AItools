from __future__ import annotations

from toolset_core.models import ExecutionContext, ToolMetadata


class EchoTool:
    def metadata(self) -> ToolMetadata:
        return ToolMetadata(
            name="echo",
            version="1.0.0",
            description="Echo input text",
            input_schema={
                "type": "object",
                "properties": {"text": {"type": "string"}},
                "required": ["text"],
            },
            output_schema={"type": "object", "properties": {"text": {"type": "string"}}},
            tags=["demo"],
        )

    async def invoke(self, input: dict, context: ExecutionContext) -> dict:
        return {"text": input.get("text", "")}


TOOL = EchoTool()

