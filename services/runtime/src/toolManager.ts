import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Tool, ToolMetadata, ToolsetError } from "@toolset/core";
import { z } from "zod";

const ToolModuleSchema = z.object({ tool: z.any() });

export type LoadedTool = {
  name: string;
  filePath: string;
  metadata: ToolMetadata;
  tool: Tool;
  status: "ready" | "failed";
  last_error?: string;
};

export class ToolManager {
  private tools = new Map<string, LoadedTool>();

  constructor(private toolsDir: string) {}

  list() {
    return Array.from(this.tools.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  get(name: string) {
    return this.tools.get(name) ?? null;
  }

  async reload() {
    this.tools.clear();
    await fs.mkdir(this.toolsDir, { recursive: true });
    const files = await fs.readdir(this.toolsDir);
    const candidates = files.filter((f: string) => f.endsWith(".js") || f.endsWith(".mjs"));
    for (const f of candidates) {
      await this.loadOne(path.join(this.toolsDir, f));
    }
  }

  async loadOne(filePath: string) {
    const url = pathToFileURL(filePath);
    url.searchParams.set("t", String(Date.now()));
    try {
      const mod = await import(url.href);
      const parsed = ToolModuleSchema.safeParse(mod);
      if (!parsed.success) throw new Error("invalid module export");
      const tool: Tool = (mod as any).tool;
      const meta = tool.metadata();
      this.tools.set(meta.name, { name: meta.name, filePath, metadata: meta, tool, status: "ready" });
    } catch (e: any) {
      const nameGuess = path.basename(filePath).replace(/\.(mjs|js)$/, "");
      this.tools.set(nameGuess, {
        name: nameGuess,
        filePath,
        metadata: { name: nameGuess, version: "0.0.0", description: "failed to load" },
        tool: {
          metadata() {
            return { name: nameGuess, version: "0.0.0", description: "failed to load" };
          },
          async invoke() {
            throw new ToolsetError("2xx.tool_load_failed", { tool: nameGuess, error: String(e?.message ?? e) });
          }
        },
        status: "failed",
        last_error: String(e?.message ?? e)
      });
    }
  }
}
