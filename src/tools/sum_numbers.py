from __future__ import annotations

from toolset_core.models import ExecutionContext, ToolMetadata


class SumNumbers:
    def metadata(self) -> ToolMetadata:
        return ToolMetadata(
            name="sum_numbers",
            version="1.0.0",
            description="Sum a list of numbers",
            input_schema={
                "type": "object",
                "properties": {"numbers": {"type": "array", "items": {"type": "number"}}},
                "required": ["numbers"],
            },
            output_schema={"type": "object", "properties": {"sum": {"type": "number"}}},
            tags=["math"],
        )

    async def invoke(self, input: dict, context: ExecutionContext) -> dict:
        nums = input.get("numbers") or []
        total = 0.0
        for n in nums:
            total += float(n)
        return {"sum": total}


TOOL = SumNumbers()

