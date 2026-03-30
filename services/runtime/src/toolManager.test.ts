import { describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { ToolManager } from "./toolManager";

describe("ToolManager", () => {
  it("loads and invokes a tool", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "toolset-tools-"));
    const toolFile = path.join(dir, "echo.mjs");
    await fs.writeFile(
      toolFile,
      `export const tool = {\n  metadata(){return {name:'echo',version:'1.0.0',description:'x'}},\n  async invoke(input){return {v: input.v}}\n};\n`,
      "utf-8"
    );
    const m = new ToolManager(dir);
    await m.reload();
    const t = m.get("echo");
    expect(t?.status).toBe("ready");
    const out = await t!.tool.invoke({ v: 1 }, { extra: {} } as any);
    expect(out).toEqual({ v: 1 });
  });
});

