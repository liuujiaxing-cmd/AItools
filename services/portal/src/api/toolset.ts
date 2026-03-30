export type ToolMetadata = {
  name: string;
  version: string;
  description?: string;
  tags?: string[];
  input_schema?: unknown;
  output_schema?: unknown;
  cache_ttl_seconds?: number;
};

export type ToolRecord = {
  metadata: ToolMetadata;
  status: string;
  last_error?: unknown;
};

export type ToolListResponse = { tools: ToolRecord[] };
export type ToolDetailResponse = { tool: ToolRecord };
export type ToolDocsResponse = {
  tool: {
    metadata: ToolMetadata;
    request_example?: unknown;
    response_example?: unknown;
  };
};

export type InvokeResponse = {
  output: unknown;
  meta?: { tool?: string; request_id?: string; cache?: string };
};

export type ErrorResponse = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    request_id?: string;
  };
};

export type ApiError = Error & {
  data?: unknown;
  status?: number;
};

type FetchOptions = {
  method?: "GET" | "POST";
  bearerToken?: string;
  body?: unknown;
  signal?: AbortSignal;
};

function joinUrl(baseUrl: string, path: string) {
  const b = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

async function readJsonSafely(r: Response) {
  const ct = r.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return (await r.json()) as unknown;
  const text = await r.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

export async function apiFetch<T>(baseUrl: string, path: string, opts: FetchOptions = {}) {
  const url = joinUrl(baseUrl, path);
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.bearerToken) headers.authorization = `Bearer ${opts.bearerToken}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";

  const r = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: opts.signal
  });

  const data = await readJsonSafely(r);
  if (!r.ok) {
    const e = data as ErrorResponse;
    const code = e.error?.code ? ` ${e.error.code}` : "";
    const msg = e.error?.message ?? `HTTP ${r.status}`;
    const err: ApiError = new Error(`${msg}${code}`);
    err.data = data;
    err.status = r.status;
    throw err;
  }
  return data as T;
}

export async function getHealthz(baseUrl: string) {
  return apiFetch<{ ok: boolean }>(baseUrl, "/healthz");
}

export async function getTools(baseUrl: string, bearerToken?: string) {
  return apiFetch<ToolListResponse>(baseUrl, "/v1/tools", { bearerToken });
}

export async function getTool(baseUrl: string, toolName: string, bearerToken?: string) {
  return apiFetch<ToolDetailResponse>(baseUrl, `/v1/tools/${encodeURIComponent(toolName)}`, { bearerToken });
}

export async function getToolDocs(baseUrl: string, toolName: string, bearerToken?: string) {
  return apiFetch<ToolDocsResponse>(baseUrl, `/v1/tools/${encodeURIComponent(toolName)}/docs`, { bearerToken });
}

export async function invokeTool(baseUrl: string, toolName: string, payload: unknown, bearerToken?: string) {
  return apiFetch<InvokeResponse>(baseUrl, `/v1/tools/${encodeURIComponent(toolName)}:invoke`, {
    method: "POST",
    bearerToken,
    body: payload
  });
}

export async function getDemoToken(baseUrl: string) {
  return apiFetch<{ access_token: string; token_type: string; expires_in: number }>(baseUrl, "/v1/oauth/token", {
    method: "POST",
    body: { client_id: "demo", client_secret: "demo" }
  });
}
