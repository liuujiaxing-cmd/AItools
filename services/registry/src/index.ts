import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import crypto from "node:crypto";
import { Registry, collectDefaultMetrics, Counter, Histogram } from "prom-client";

import { ToolsetError, ensureRequestId, errorToResponse } from "@toolset/core";
import { createDb, migrate } from "./db";

const env = {
  PORT: Number(process.env.PORT ?? "8082")
};

let sql: any = null;
const mem = {
  tools: [] as any[],
  apiKeys: [] as any[]
};

try {
  sql = createDb();
  await migrate(sql);
} catch {
  sql = null;
}

const app = Fastify({
  logger: {
    level: "info",
    transport: process.env.ENV === "dev" ? { target: "pino-pretty" } : undefined
  }
});

const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: "registry_" });
const httpRequests = new Counter({
  name: "registry_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "path", "status"] as const,
  registers: [metricsRegistry]
});
const httpLatency = new Histogram({
  name: "registry_http_request_duration_seconds",
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
    info: { title: "Toolset Registry", version: "1.0.0" }
  }
});
app.register(swaggerUi, { routePrefix: "/docs" });

app.get("/healthz", async () => ({ ok: true }));

app.get("/metrics", async (_req: any, reply: any) => {
  reply.header("content-type", metricsRegistry.contentType);
  return await metricsRegistry.metrics();
});

app.post("/v1/tools", {
  schema: {
    body: {
      type: "object",
      required: ["name", "version", "description", "entrypoint"],
      properties: {
        name: { type: "string" },
        version: { type: "string" },
        description: { type: "string" },
        entrypoint: { type: "string" },
        dependencies: { type: "array", items: { type: "string" } },
        config_schema: { type: "object" },
        enabled: { type: "boolean" }
      }
    }
  }
}, async (req: any) => {
  const b = req.body;
  if (sql) {
    await sql`
      insert into tools(name, version, description, entrypoint, dependencies, config_schema, enabled)
      values(${b.name}, ${b.version}, ${b.description}, ${b.entrypoint}, ${JSON.stringify(b.dependencies ?? [])}::jsonb, ${JSON.stringify(b.config_schema ?? {})}::jsonb, ${b.enabled ?? true})
      on conflict(name, version)
      do update set description=excluded.description, entrypoint=excluded.entrypoint, dependencies=excluded.dependencies, config_schema=excluded.config_schema, enabled=excluded.enabled
    `;
  } else {
    const idx = mem.tools.findIndex((t) => t.name === b.name && t.version === b.version);
    const rec = {
      name: b.name,
      version: b.version,
      description: b.description,
      entrypoint: b.entrypoint,
      dependencies: b.dependencies ?? [],
      config_schema: b.config_schema ?? {},
      enabled: b.enabled ?? true
    };
    if (idx >= 0) mem.tools[idx] = rec;
    else mem.tools.push(rec);
  }
  return { ok: true };
});

app.get("/v1/tools", async () => {
  if (sql) {
    const rows = await sql`select name, version, description, entrypoint, dependencies, config_schema, enabled from tools order by name, version`;
    return { tools: rows };
  }
  return { tools: mem.tools.slice().sort((a, b) => (a.name + a.version).localeCompare(b.name + b.version)) };
});

app.get("/v1/tools/:toolName", async (req: any) => {
  if (sql) {
    const rows = await sql`select name, version, description, entrypoint, dependencies, config_schema, enabled from tools where name=${req.params.toolName} order by version`;
    return { tools: rows };
  }
  return { tools: mem.tools.filter((t) => t.name === req.params.toolName) };
});

app.post("/v1/apikeys", {
  schema: {
    body: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
        scopes: { type: "array", items: { type: "string" } }
      }
    }
  }
}, async (req: any) => {
  const name = String(req.body.name);
  const scopes = Array.isArray(req.body.scopes) ? req.body.scopes.map(String) : ["tools:invoke", "tools:read"];
  const api_key_id = crypto.randomBytes(8).toString("hex");
  const api_key = "ak_" + crypto.randomBytes(18).toString("base64url");
  const api_secret = "sk_" + crypto.randomBytes(32).toString("base64url");
  if (sql) {
    await sql`
      insert into api_keys(api_key_id, api_key, api_secret, name, scopes, enabled)
      values(${api_key_id}, ${api_key}, ${api_secret}, ${name}, ${JSON.stringify(scopes)}::jsonb, true)
    `;
  } else {
    mem.apiKeys.push({ api_key_id, api_key, api_secret, name, scopes, enabled: true });
  }
  return { api_key_id, api_key, api_secret, name, scopes };
});

app.get("/v1/apikeys/resolve", async (req: any) => {
  const apiKey = String(req.query.api_key ?? "");
  if (!apiKey) throw new ToolsetError("1xx.invalid_request", { reason: "missing_api_key" });
  if (sql) {
    const rows = await sql`select api_key_id, api_secret, name, scopes, enabled from api_keys where api_key=${apiKey} limit 1`;
    if (rows.length === 0 || !rows[0].enabled) throw new ToolsetError("3xx.unauthorized", { reason: "invalid_api_key" });
    return { api_key_id: rows[0].api_key_id, api_secret: rows[0].api_secret, name: rows[0].name, scopes: rows[0].scopes };
  }
  const rec = mem.apiKeys.find((k) => k.api_key === apiKey);
  if (!rec || !rec.enabled) throw new ToolsetError("3xx.unauthorized", { reason: "invalid_api_key" });
  return { api_key_id: rec.api_key_id, api_secret: rec.api_secret, name: rec.name, scopes: rec.scopes };
});

app.setErrorHandler(async (err: any, req: any, reply: any) => {
  const rid = req.headers["x-request-id"]?.toString();
  const accept = req.headers["accept-language"]?.toString();
  const { statusCode, body } = errorToResponse(err, accept, rid);
  reply.code(statusCode).send(body);
});

await app.listen({ port: env.PORT, host: "0.0.0.0" });
