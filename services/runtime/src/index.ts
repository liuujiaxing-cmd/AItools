import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import chokidar from "chokidar";
import Redis from "ioredis";
import Ajv from "ajv";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Registry, collectDefaultMetrics, Counter, Histogram } from "prom-client";

import {
  ToolInvokeRequestSchema,
  ToolInvokeResponse,
  ToolsetError,
  ensureRequestId,
  errorToResponse
} from "@toolset/core";

import { ToolManager } from "./toolManager";

const env = {
  PORT: Number(process.env.PORT ?? "8081"),
  TOOLS_DIR: String(process.env.TOOLS_DIR ?? "tools"),
  REDIS_URL: String(process.env.REDIS_URL ?? "redis://localhost:6379/0"),
  CACHE_DEFAULT_TTL: Number(process.env.TOOL_CACHE_DEFAULT_TTL_SECONDS ?? "0")
};

const redis = new Redis(env.REDIS_URL);
redis.on("error", () => {});
const localCache = new Map<string, { value: any; expiresAt: number }>();

function cacheGet(key: string) {
  const e = localCache.get(key);
  if (!e) return null;
  if (Date.now() >= e.expiresAt) {
    localCache.delete(key);
    return null;
  }
  return e.value;
}

function cacheSet(key: string, value: any, ttlSeconds: number) {
  if (ttlSeconds <= 0) return;
  if (localCache.size > 4096) {
    const first = localCache.keys().next().value;
    if (first) localCache.delete(first);
  }
  localCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

const manager = new ToolManager(env.TOOLS_DIR);
await manager.reload();

const ajv = new Ajv({ allErrors: true, strict: false });
const validatorCache = new Map<string, any>();

function validateToolInput(toolName: string, schema: any, data: any) {
  if (!schema) return;
  const key = `${toolName}:${JSON.stringify(schema)}`;
  let validate = validatorCache.get(key);
  if (!validate) {
    validate = ajv.compile(schema);
    validatorCache.set(key, validate);
  }
  const ok = validate(data);
  if (!ok) {
    throw new ToolsetError("1xx.invalid_request", { reason: "schema_validation", errors: validate.errors });
  }
}

chokidar
  .watch(env.TOOLS_DIR, { ignoreInitial: true })
  .on("add", async (p: string) => manager.loadOne(p))
  .on("change", async (p: string) => manager.loadOne(p))
  .on("unlink", async () => manager.reload());

const app = Fastify({
  logger: {
    level: "info",
    transport: process.env.ENV === "dev" ? { target: "pino-pretty" } : undefined
  }
});

const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: "runtime_" });
const httpRequests = new Counter({
  name: "runtime_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "path", "status"] as const,
  registers: [metricsRegistry]
});
const httpLatency = new Histogram({
  name: "runtime_http_request_duration_seconds",
  help: "HTTP request duration seconds",
  labelNames: ["method", "path"] as const,
  registers: [metricsRegistry]
});

app.addHook("onRequest", async (req: any) => {
  req._startAt = process.hrtime.bigint();
});

app.addHook("onResponse", async (req: any, reply: any) => {
  const start = req._startAt as bigint | undefined;
  if (!start) return;
  const dur = Number(process.hrtime.bigint() - start) / 1e9;
  const pathLabel = req.routerPath ?? req.url;
  httpRequests.inc({ method: req.method, path: pathLabel, status: String(reply.statusCode) });
  httpLatency.observe({ method: req.method, path: pathLabel }, dur);
});

app.addHook("onRequest", async (req, reply) => {
  const requestId = ensureRequestId(req.headers["x-request-id"]);
  req.headers["x-request-id"] = requestId;
  reply.header("x-request-id", requestId);
});

app.register(swagger, {
  openapi: {
    info: { title: "Toolset Runtime", version: "1.0.0" }
  }
});
app.register(swaggerUi, { routePrefix: "/docs" });

app.get("/healthz", async () => ({ ok: true }));

app.get("/metrics", async (_req: any, reply: any) => {
  reply.header("content-type", metricsRegistry.contentType);
  return await metricsRegistry.metrics();
});

app.get("/v1/tools", async () => ({
  tools: manager.list().map((t) => ({ metadata: t.metadata, status: t.status, last_error: t.last_error }))
}));

app.get("/v1/tools/:toolName", async (req: any) => {
  const t = manager.get(req.params.toolName);
  if (!t) throw new ToolsetError("2xx.tool_not_found", { tool: req.params.toolName });
  return { tool: { metadata: t.metadata, status: t.status, last_error: t.last_error } };
});

app.get("/v1/tools/:toolName/docs", async (req: any) => {
  const t = manager.get(req.params.toolName);
  if (!t) throw new ToolsetError("2xx.tool_not_found", { tool: req.params.toolName });
  return {
    tool: {
      metadata: t.metadata,
      request_example: { input: {}, context: {}, options: {} },
      response_example: { output: {}, meta: { tool: t.metadata.name } }
    }
  };
});

app.post("/v1/tools/reload", async () => {
  await manager.reload();
  return { tools: manager.list().map((t) => ({ metadata: t.metadata, status: t.status, last_error: t.last_error })) };
});

app.post("/v1/tools/register", {
  schema: {
    body: {
      type: "object",
      required: ["file_name", "source_code"],
      properties: { file_name: { type: "string" }, source_code: { type: "string" } }
    }
  }
}, async (req: any) => {
  const fileName: string = req.body.file_name;
  if (!fileName.endsWith(".mjs") && !fileName.endsWith(".js")) throw new ToolsetError("1xx.invalid_request", { reason: "invalid_file_name" });
  if (fileName.startsWith("_")) throw new ToolsetError("1xx.invalid_request", { reason: "invalid_file_name" });
  await fs.mkdir(env.TOOLS_DIR, { recursive: true });
  const target = path.join(env.TOOLS_DIR, fileName);
  await fs.writeFile(target, req.body.source_code, "utf-8");
  await manager.loadOne(target);
  return { ok: true, file: fileName };
});

app.post("/v1/tools/:toolName([^:]+):invoke", async (req: any, reply: any) => {
  const parsed = ToolInvokeRequestSchema.safeParse(req.body);
  if (!parsed.success) throw new ToolsetError("1xx.invalid_request", { reason: "schema", issues: parsed.error.issues });

  const toolName = req.params.toolName as string;
  const t = manager.get(toolName);
  if (!t || t.status !== "ready") throw new ToolsetError("2xx.tool_not_found", { tool: toolName });

  validateToolInput(toolName, t.metadata.input_schema, parsed.data.input);

  const requestId = req.headers["x-request-id"]?.toString();
  const ctx = { ...parsed.data.context };
  ctx.request_id = requestId;
  ctx.user_id = req.headers["x-openclaw-user"]?.toString() ?? ctx.user_id;
  ctx.api_key_id = req.headers["x-openclaw-apikey-id"]?.toString() ?? ctx.api_key_id;

  const ttl = Number(t.metadata.cache_ttl_seconds ?? env.CACHE_DEFAULT_TTL ?? 0);
  let cacheKey = "";
  if (ttl > 0) {
    const payload = JSON.stringify(parsed.data.input);
    const digest = crypto.createHash("sha256").update(payload).digest("hex");
    cacheKey = `toolcache:${toolName}:${digest}`;

    const local = cacheGet(cacheKey);
    if (local) {
      const resp: ToolInvokeResponse = { output: local, meta: { tool: toolName, request_id: requestId, cache: "local" } };
      return resp;
    }
    try {
      const r = await redis.get(cacheKey);
      if (r) {
        const val = JSON.parse(r);
        cacheSet(cacheKey, val, ttl);
        const resp: ToolInvokeResponse = { output: val, meta: { tool: toolName, request_id: requestId, cache: "redis" } };
        return resp;
      }
    } catch {
      // ignore
    }
  }

  const out = await t.tool.invoke(parsed.data.input, ctx);
  if (ttl > 0 && cacheKey) {
    cacheSet(cacheKey, out, ttl);
    try {
      await redis.set(cacheKey, JSON.stringify(out), "EX", ttl);
    } catch {
      // ignore
    }
  }

  const resp: ToolInvokeResponse = { output: out, meta: { tool: toolName, request_id: requestId } };
  reply.code(200);
  return resp;
});

app.setErrorHandler(async (err: any, req: any, reply: any) => {
  const rid = req.headers["x-request-id"]?.toString();
  const accept = req.headers["accept-language"]?.toString();
  const { statusCode, body } = errorToResponse(err, accept, rid);
  reply.code(statusCode).send(body);
});

await app.listen({ port: env.PORT, host: "0.0.0.0" });
