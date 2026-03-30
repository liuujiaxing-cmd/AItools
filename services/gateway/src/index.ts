import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import cors from "@fastify/cors";
import rawBody from "fastify-raw-body";
import Redis from "ioredis";
import { request } from "undici";
import { Registry, collectDefaultMetrics, Counter, Histogram } from "prom-client";

import {
  ERROR_CATALOG,
  ToolInvokeRequestSchema,
  ToolsetError,
  ensureRequestId,
  errorToResponse,
  issueJwt,
  verifyJwt,
  verifySignature,
  TokenBucketLimiter
} from "@toolset/core";

const env = {
  PORT: Number(process.env.PORT ?? "8080"),
  RUNTIME_BASE_URL: String(process.env.RUNTIME_BASE_URL ?? "http://localhost:8081"),
  REGISTRY_BASE_URL: String(process.env.REGISTRY_BASE_URL ?? "http://localhost:8082"),
  REDIS_URL: String(process.env.REDIS_URL ?? "redis://localhost:6379/0"),
  JWT_ISSUER: String(process.env.GATEWAY_JWT_ISSUER ?? "toolset"),
  JWT_AUDIENCE: String(process.env.GATEWAY_JWT_AUDIENCE ?? "openclaw"),
  JWT_SECRET: String(process.env.GATEWAY_JWT_SECRET ?? "change-me"),
  TOKEN_TTL_SECONDS: Number(process.env.GATEWAY_TOKEN_TTL_SECONDS ?? "3600"),
  ALLOWED_IPS: String(process.env.GATEWAY_ALLOWED_IPS ?? "").trim(),
  REQUIRE_SIGNATURE: String(process.env.GATEWAY_REQUIRE_SIGNATURE ?? "false").toLowerCase() === "true"
};

const redis = new Redis(env.REDIS_URL);
redis.on("error", () => {});
const limiter = new TokenBucketLimiter(redis);

type CacheEntry = { expiresAt: number; statusCode: number; body: unknown };
const responseCache = new Map<string, CacheEntry>();

function getCached(key: string) {
  const hit = responseCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return hit;
}

function setCached(key: string, statusCode: number, body: unknown, ttlMs: number) {
  responseCache.set(key, { expiresAt: Date.now() + ttlMs, statusCode, body });
}

const app = Fastify({
  logger: {
    level: "info",
    transport: process.env.ENV === "dev" ? { target: "pino-pretty" } : undefined
  }
});

const corsOrigins = String(process.env.GATEWAY_CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
await app.register(cors, {
  origin: async (origin: string | undefined) => {
    if (!origin) return true;
    if (corsOrigins.length > 0) return corsOrigins.includes(origin);
    if (origin.startsWith("http://localhost:") || origin.startsWith("https://localhost:")) return true;
    if (origin.startsWith("http://127.0.0.1:") || origin.startsWith("https://127.0.0.1:")) return true;
    if (origin.startsWith("http://10.") || origin.startsWith("https://10.")) return true;
    if (origin.startsWith("http://192.168.") || origin.startsWith("https://192.168.")) return true;
    return false;
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["authorization", "content-type", "x-api-key", "x-signature", "x-timestamp", "x-nonce", "x-request-id", "accept-language"],
  exposedHeaders: ["x-request-id"]
});

await app.register(rawBody, { field: "rawBody", global: true, encoding: false, runFirst: true });

const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: "gateway_" });
const httpRequests = new Counter({
  name: "gateway_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "path", "status"] as const,
  registers: [metricsRegistry]
});
const httpLatency = new Histogram({
  name: "gateway_http_request_duration_seconds",
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
  const path = req.routerPath ?? req.url;
  httpRequests.inc({ method: req.method, path, status: String(reply.statusCode) });
  httpLatency.observe({ method: req.method, path }, dur);
});

app.addHook("onRequest", async (req, reply) => {
  const requestId = ensureRequestId(req.headers["x-request-id"]);
  req.headers["x-request-id"] = requestId;
  reply.header("x-request-id", requestId);

  if (env.ALLOWED_IPS) {
    const allowed = new Set(env.ALLOWED_IPS.split(",").map((s) => s.trim()).filter(Boolean));
    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ?? req.ip;
    if (allowed.size > 0 && !allowed.has(ip)) throw new ToolsetError("3xx.forbidden", { reason: "ip_not_allowed", ip });
  }
});

async function enforceRateLimit(req: any, principal: any | null, apiKeyId: string | null) {
  const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ?? req.ip;
  const baseKey = `${req.method}:${req.routerPath ?? req.url}`;
  const checks: Array<{ key: string; rule: { capacity: number; refillPerSecond: number } }> = [
    { key: `ip:${ip}:${baseKey}`, rule: { capacity: 60, refillPerSecond: 1 } }
  ];
  if (principal) checks.push({ key: `user:${principal.sub}:${baseKey}`, rule: { capacity: 120, refillPerSecond: 2 } });
  if (apiKeyId) checks.push({ key: `ak:${apiKeyId}:${baseKey}`, rule: { capacity: 120, refillPerSecond: 2 } });
  for (const c of checks) {
    let ok = true;
    try {
      ok = await limiter.allow(c.key, c.rule);
    } catch {
      ok = true;
    }
    if (!ok) throw new ToolsetError("3xx.rate_limited", { key: c.key });
  }
}

async function resolveApiKey(apiKey: string) {
  const url = `${env.REGISTRY_BASE_URL}/v1/apikeys/resolve?api_key=${encodeURIComponent(apiKey)}`;
  const r = await request(url, { method: "GET" });
  if (r.statusCode !== 200) return null;
  return (await r.body.json()) as { api_key_id: string; api_secret: string; name: string; scopes: string[] };
}

async function authenticate(req: any) {
  const auth = req.headers.authorization?.toString();
  const apiKey = req.headers["x-api-key"]?.toString();

  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.split(" ", 2)[1] ?? "";
    const principal = await verifyJwt({
      token,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      secret: env.JWT_SECRET
    });
    await enforceRateLimit(req, principal, null);
    return principal;
  }

  if (apiKey) {
    const rec = await resolveApiKey(apiKey);
    if (!rec) throw new ToolsetError("3xx.unauthorized", { reason: "invalid_api_key" });

    if (env.REQUIRE_SIGNATURE) {
      const sig = req.headers["x-signature"]?.toString();
      const ts = req.headers["x-timestamp"]?.toString();
      const nonce = req.headers["x-nonce"]?.toString();
      if (!sig || !ts || !nonce) throw new ToolsetError("3xx.signature_invalid", { reason: "missing_headers" });
      const body = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody ?? "");
      verifySignature({
        secret: rec.api_secret,
        provided: sig,
        method: req.method,
        path: req.url,
        ts,
        nonce,
        body
      });
      const nonceKey = `nonce:${rec.api_key_id}:${nonce}`;
      try {
        const ok = await redis.set(nonceKey, "1", "EX", 600, "NX");
        if (!ok) throw new ToolsetError("3xx.signature_invalid", { reason: "replay_detected" });
      } catch {
        throw new ToolsetError("5xx.internal", { reason: "nonce_backend_unavailable" });
      }
    }

    const principal = { sub: rec.name, kind: "api_key", scopes: rec.scopes, api_key_id: rec.api_key_id };
    await enforceRateLimit(req, principal, rec.api_key_id);
    return principal;
  }

  await enforceRateLimit(req, null, null);
  return null;
}

app.register(swagger, {
  openapi: {
    info: { title: "Toolset Gateway", version: "1.0.0" }
  }
});
app.register(swaggerUi, { routePrefix: "/docs" });

app.get("/healthz", async () => ({ ok: true }));

app.get("/metrics", async (_req: any, reply: any) => {
  reply.header("content-type", metricsRegistry.contentType);
  return await metricsRegistry.metrics();
});

app.get("/v1/docs/errors", async () => ({
  errors: Object.entries(ERROR_CATALOG).map(([code, v]) => ({ code, message: { zh: v.zh, en: v.en } }))
}));

app.post("/v1/oauth/token", {
  schema: {
    body: {
      type: "object",
      required: ["client_id", "client_secret"],
      properties: { client_id: { type: "string" }, client_secret: { type: "string" } }
    }
  }
}, async (req: any) => {
  const { client_id, client_secret } = req.body;
  if (!(client_id === "demo" && client_secret === "demo")) throw new ToolsetError("3xx.unauthorized", { reason: "invalid_client" });
  const token = await issueJwt({
    subject: client_id,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    secret: env.JWT_SECRET,
    ttlSeconds: env.TOKEN_TTL_SECONDS
  });
  return { access_token: token, token_type: "bearer", expires_in: env.TOKEN_TTL_SECONDS };
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
  const principal = await authenticate(req);
  if (!principal || principal.kind !== "jwt") throw new ToolsetError("3xx.forbidden", { reason: "admin_required" });

  const r = await request(`${env.REGISTRY_BASE_URL}/v1/apikeys`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req.body)
  });
  const data = await r.body.json();
  return data;
});

app.get("/v1/tools", async (req: any) => {
  await authenticate(req);
  const cacheKey = "runtime:/v1/tools";
  const cached = getCached(cacheKey);
  if (cached) return cached.body;

  const r = await request(`${env.RUNTIME_BASE_URL}/v1/tools`, { method: "GET" });
  const data = await r.body.json();
  if (r.statusCode === 200) setCached(cacheKey, r.statusCode, data, 2000);
  return data;
});

app.get("/v1/tools/:toolName", async (req: any, reply: any) => {
  await authenticate(req);
  const toolName = String(req.params.toolName);
  const cacheKey = `runtime:/v1/tools/${toolName}`;
  const cached = getCached(cacheKey);
  if (cached) {
    reply.code(cached.statusCode);
    return cached.body;
  }

  const r = await request(`${env.RUNTIME_BASE_URL}/v1/tools/${encodeURIComponent(toolName)}`, { method: "GET" });
  const data = await r.body.json();
  reply.code(r.statusCode);
  if (r.statusCode === 200) setCached(cacheKey, r.statusCode, data, 2000);
  return data;
});

app.get("/v1/tools/:toolName/docs", async (req: any, reply: any) => {
  await authenticate(req);
  const toolName = String(req.params.toolName);
  const cacheKey = `runtime:/v1/tools/${toolName}/docs`;
  const cached = getCached(cacheKey);
  if (cached) {
    reply.code(cached.statusCode);
    return cached.body;
  }

  const r = await request(`${env.RUNTIME_BASE_URL}/v1/tools/${encodeURIComponent(toolName)}/docs`, { method: "GET" });
  const data = await r.body.json();
  reply.code(r.statusCode);
  if (r.statusCode === 200) setCached(cacheKey, r.statusCode, data, 5000);
  return data;
});

app.post("/v1/tools/:toolName([^:]+):invoke", async (req: any, reply) => {
  const principal = await authenticate(req);
  const parsed = ToolInvokeRequestSchema.safeParse(req.body);
  if (!parsed.success) throw new ToolsetError("1xx.invalid_request", { reason: "schema", issues: parsed.error.issues });

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-request-id": req.headers["x-request-id"]?.toString() ?? ""
  };
  if (principal) {
    headers["x-openclaw-user"] = principal.sub;
    if (principal.api_key_id) headers["x-openclaw-apikey-id"] = principal.api_key_id;
  }

  const r = await request(`${env.RUNTIME_BASE_URL}/v1/tools/${req.params.toolName}:invoke`, {
    method: "POST",
    headers,
    body: JSON.stringify(parsed.data)
  });
  const data = await r.body.json();
  reply.code(r.statusCode);
  return data;
});

app.setErrorHandler(async (err: any, req: any, reply: any) => {
  const rid = req.headers["x-request-id"]?.toString();
  const accept = req.headers["accept-language"]?.toString();
  const { statusCode, body } = errorToResponse(err, accept, rid);
  reply.code(statusCode).send(body);
});

await app.listen({ port: env.PORT, host: "0.0.0.0" });
