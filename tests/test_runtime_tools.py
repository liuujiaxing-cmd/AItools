from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from toolset_core.models import ExecutionContext
from toolset_core.tool_manager import ToolManager


@pytest.mark.asyncio
async def test_tool_manager_load_and_invoke():
    with tempfile.TemporaryDirectory() as d:
        tools_dir = Path(d)
        tools_dir.joinpath("echo.py").write_text(
            """
from toolset_core.models import ExecutionContext, ToolMetadata

class T:
    def metadata(self):
        return ToolMetadata(name='echo', version='1.0.0', description='x', input_schema={}, output_schema={})
    async def invoke(self, input, context: ExecutionContext):
        return {'ok': input.get('v')}

TOOL = T()
""".strip(),
            encoding="utf-8",
        )
        m = ToolManager(str(tools_dir))
        await m.reload()
        out = await m.invoke("echo", {"v": 1}, ExecutionContext())
        assert out == {"ok": 1}


@pytest.mark.asyncio
async def test_tool_manager_reload_updates_code():
    with tempfile.TemporaryDirectory() as d:
        tools_dir = Path(d)
        tool_file = tools_dir / "echo.py"
        tool_file.write_text(
            """
from toolset_core.models import ExecutionContext, ToolMetadata

class T:
    def metadata(self):
        return ToolMetadata(name='echo', version='1.0.0', description='x', input_schema={}, output_schema={})
    async def invoke(self, input, context: ExecutionContext):
        return {'v': 1}

TOOL = T()
""".strip(),
            encoding="utf-8",
        )
        m = ToolManager(str(tools_dir))
        await m.reload()
        out1 = await m.invoke("echo", {}, ExecutionContext())
        assert out1["v"] == 1

        tool_file.write_text(
            """
from toolset_core.models import ExecutionContext, ToolMetadata

class T:
    def metadata(self):
        return ToolMetadata(name='echo', version='1.0.0', description='x', input_schema={}, output_schema={})
    async def invoke(self, input, context: ExecutionContext):
        return {'v': 2}

TOOL = T()
""".strip(),
            encoding="utf-8",
        )
        await m.reload()
        out2 = await m.invoke("echo", {}, ExecutionContext())
        assert out2["v"] == 2

