import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Clipboard, KeyRound, Play, Sparkles, RotateCcw } from "lucide-react";

import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import JsonTextarea from "@/components/JsonTextarea";
import SchemaForm from "@/components/SchemaForm";
import { getDemoToken, getTool, getTools, invokeTool, ToolRecord } from "@/api/toolset";
import { usePortalStore } from "@/store/portalStore";
import { getErrorMessage } from "@/utils/errors";
import { safeJsonStringify } from "@/utils/json";
import { copyToClipboard } from "@/utils/clipboard";
import { inferExampleFromJsonSchema } from "@/utils/jsonSchemaExample";

function safeParseJson(input: string) {
  try {
    return { ok: true as const, value: JSON.parse(input) as unknown };
  } catch (e: unknown) {
    return { ok: false as const, error: getErrorMessage(e) };
  }
}

export default function Playground() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    gatewayBaseUrl,
    bearerToken,
    setBearerToken
  } = usePortalStore();

  const [tools, setTools] = useState<ToolRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const [selectedTool, setSelectedTool] = useState<string>(String(searchParams.get("tool") ?? ""));
  const [toolSchema, setToolSchema] = useState<unknown>(null);

  const [mode, setMode] = useState<"form" | "json">("form");
  const [formValue, setFormValue] = useState<Record<string, unknown>>({});
  const [inputJson, setInputJson] = useState("{}\n");
  const [contextJson, setContextJson] = useState("{}\n");
  const [response, setResponse] = useState<unknown>(null);
  const [invokeError, setInvokeError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");

  useEffect(() => {
    let alive = true;
    setErr("");
    getTools(gatewayBaseUrl, bearerToken)
      .then((r) => {
        if (!alive) return;
        setTools(r.tools ?? []);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setErr(getErrorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [gatewayBaseUrl, bearerToken]);

  useEffect(() => {
    let alive = true;
    setToolSchema(null);
    if (!selectedTool) return;
    getTool(gatewayBaseUrl, selectedTool, bearerToken)
      .then((r) => {
        if (!alive) return;
        setToolSchema(r.tool.metadata.input_schema ?? null);
      })
      .catch(() => {
        if (!alive) return;
        setToolSchema(null);
      });
    return () => {
      alive = false;
    };
  }, [gatewayBaseUrl, bearerToken, selectedTool]);

  useEffect(() => {
    const p = selectedTool ? new URLSearchParams({ tool: selectedTool }) : new URLSearchParams();
    setSearchParams(p, { replace: true });
  }, [selectedTool, setSearchParams]);

  const inputPayload = useMemo(() => {
    if (mode === "form") return { ok: true as const, value: formValue };
    return safeParseJson(inputJson);
  }, [mode, formValue, inputJson]);

  const contextPayload = useMemo(() => safeParseJson(contextJson), [contextJson]);

  async function onInvoke() {
    setInvokeError("");
    setResponse(null);
    if (!selectedTool) {
      setInvokeError("请选择一个工具");
      return;
    }
    if (!inputPayload.ok) {
      setInvokeError(`input JSON 无效：${inputPayload.error}`);
      return;
    }
    if (!contextPayload.ok) {
      setInvokeError(`context JSON 无效：${contextPayload.error}`);
      return;
    }

    setLoading(true);
    try {
      const payload = { input: inputPayload.value, context: contextPayload.value, options: {} };
      const r = await invokeTool(gatewayBaseUrl, selectedTool, payload, bearerToken);
      setResponse(r);
    } catch (e: unknown) {
      setInvokeError(getErrorMessage(e));
      if (e && typeof e === "object" && "data" in e) setResponse((e as { data: unknown }).data);
    } finally {
      setLoading(false);
    }
  }

  function buildInvokePayload(exampleInput: unknown, exampleContext: unknown) {
    return { input: exampleInput ?? {}, context: exampleContext ?? {}, options: {} };
  }

  async function fillExample() {
    const ex = inferExampleFromJsonSchema(toolSchema);
    if (typeof ex === "object" && ex && !Array.isArray(ex)) syncFormToJson(ex as Record<string, unknown>);
    else {
      const obj = typeof ex === "object" && ex && !Array.isArray(ex) ? (ex as Record<string, unknown>) : {};
      syncFormToJson(obj);
    }
    setNotice("已填充示例参数");
    window.setTimeout(() => setNotice(""), 1500);
  }

  async function invokeExample() {
    setInvokeError("");
    setResponse(null);
    if (!selectedTool) {
      setInvokeError("请选择一个工具");
      return;
    }
    const ex = inferExampleFromJsonSchema(toolSchema);
    const payload = buildInvokePayload(ex ?? {}, contextPayload.ok ? contextPayload.value : {});
    setLoading(true);
    try {
      const r = await invokeTool(gatewayBaseUrl, selectedTool, payload, bearerToken);
      setResponse(r);
    } catch (e: unknown) {
      setInvokeError(getErrorMessage(e));
      if (e && typeof e === "object" && "data" in e) setResponse((e as { data: unknown }).data);
    } finally {
      setLoading(false);
    }
  }

  function buildCurl(toolName: string, token: string | null, payload: unknown) {
    const auth = token ? `  -H 'authorization: Bearer ${token}' \\\n+` : "";
    return (
      `curl -sS -X POST ${gatewayBaseUrl}/v1/tools/${encodeURIComponent(toolName)}:invoke \\\n+  -H 'content-type: application/json' \\\n+${auth}  -d '${safeJsonStringify(payload)}'\n`
    );
  }

  async function copyCurl(useDemoToken: boolean) {
    setInvokeError("");
    if (!selectedTool) {
      setInvokeError("请选择一个工具");
      return;
    }
    const ex = inferExampleFromJsonSchema(toolSchema);
    const payload = buildInvokePayload(ex ?? {}, contextPayload.ok ? contextPayload.value : {});
    let token: string | null = bearerToken || null;

    if (useDemoToken) {
      try {
        const r = await getDemoToken(gatewayBaseUrl);
        token = r.access_token;
        setBearerToken(r.access_token);
      } catch (e: unknown) {
        setInvokeError(getErrorMessage(e));
        return;
      }
    }

    const escapeForSingleQuotes = (s: string) => s.replace(/'/g, `'\\''`);
    const auth = token ? `  -H 'authorization: Bearer ${token}' \\\n+` : "";
    const body = escapeForSingleQuotes(JSON.stringify(payload));
    const cmd = `curl -sS -X POST ${gatewayBaseUrl}/v1/tools/${encodeURIComponent(selectedTool)}:invoke \\\n+  -H 'content-type: application/json' \\\n+${auth}  -d '${body}'\n`;

    await copyToClipboard(cmd.replace(/\n\+/g, "\n"));
    setNotice("已复制 cURL");
    window.setTimeout(() => setNotice(""), 1500);
  }

  async function onGetDemoToken() {
    setInvokeError("");
    setLoading(true);
    try {
      const r = await getDemoToken(gatewayBaseUrl);
      setBearerToken(r.access_token);
    } catch (e: unknown) {
      setInvokeError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function syncFormToJson(next: Record<string, unknown>) {
    setFormValue(next);
    setInputJson(`${safeJsonStringify(next)}\n`);
  }

  if (err) return <EmptyState title="无法进入在线调用" description={err} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="w-full md:max-w-md">
          <div className="text-xs font-medium text-zinc-500">选择工具</div>
          <select
            value={selectedTool}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedTool(v);
              setResponse(null);
              setInvokeError("");
              setFormValue({});
              setInputJson("{}\n");
            }}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-zinc-300 focus:ring-2 focus:ring-zinc-200"
          >
            <option value="">请选择…</option>
            {tools.map((t) => (
              <option key={t.metadata.name} value={t.metadata.name}>
                {t.metadata.name}
              </option>
            ))}
          </select>
          {selectedTool ? (
            <div className="mt-2 text-xs text-zinc-600">
              <Link className="text-zinc-900 hover:underline" to={`/tools/${encodeURIComponent(selectedTool)}`}>
                查看工具详情
              </Link>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={bearerToken ? "blue" : "neutral"}>{bearerToken ? "Bearer 已设置" : "Bearer 未设置"}</Badge>
          <button
            type="button"
            disabled={loading}
            onClick={onGetDemoToken}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
          >
            <KeyRound className="h-4 w-4" />
            获取 Demo Token
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onInvoke}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60"
          >
            <Play className="h-4 w-4" />
            调用
          </button>
          <button
            type="button"
            disabled={loading || !selectedTool}
            onClick={invokeExample}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            一键示例调用
          </button>
          <button
            type="button"
            disabled={loading || !selectedTool}
            onClick={() => copyCurl(false)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
          >
            <Clipboard className="h-4 w-4" />
            复制 cURL
          </button>
          <button
            type="button"
            disabled={loading || !selectedTool}
            onClick={() => copyCurl(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
          >
            <Clipboard className="h-4 w-4" />
            复制 cURL(含Token)
          </button>
        </div>
      </div>

      {notice ? <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">{notice}</div> : null}
      {invokeError ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{invokeError}</div> : null}

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold">输入</div>
          <button
            type="button"
            onClick={() => setMode("form")}
            className={
              mode === "form"
                ? "h-9 rounded-lg bg-zinc-900 px-3 text-sm font-semibold text-white"
                : "h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            }
          >
            表单
          </button>
          <button
            type="button"
            onClick={() => setMode("json")}
            className={
              mode === "json"
                ? "h-9 rounded-lg bg-zinc-900 px-3 text-sm font-semibold text-white"
                : "h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            }
          >
            JSON
          </button>

          <button
            type="button"
            disabled={!selectedTool}
            onClick={fillExample}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            填充示例
          </button>

          <button
            type="button"
            onClick={() => {
              setFormValue({});
              setInputJson("{}\n");
              setContextJson("{}\n");
              setResponse(null);
              setInvokeError("");
            }}
            className="ml-auto inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <RotateCcw className="h-4 w-4" />
            重置
          </button>
        </div>

        <div className="mt-3">
          {mode === "form" ? (
            <div className="space-y-3">
              <SchemaForm schema={toolSchema} value={formValue} onChange={syncFormToJson} />
              <div>
                <div className="text-xs font-medium text-zinc-500">input JSON（随表单同步，可手动修改）</div>
                <div className="mt-2">
                  <JsonTextarea
                    value={inputJson}
                    onChange={(v) => {
                      setInputJson(v);
                      const parsed = safeParseJson(v);
                      if (parsed.ok && typeof parsed.value === "object" && parsed.value && !Array.isArray(parsed.value)) {
                        setFormValue(parsed.value as Record<string, unknown>);
                      }
                    }}
                    rows={10}
                  />
                </div>
              </div>
            </div>
          ) : (
            <JsonTextarea value={inputJson} onChange={setInputJson} rows={14} />
          )}
        </div>

        <div className="mt-4">
          <div className="text-xs font-medium text-zinc-500">context（可选）</div>
          <div className="mt-2">
            <JsonTextarea value={contextJson} onChange={setContextJson} rows={6} placeholder="{}" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold">响应</div>
        <div className="mt-3">
          <JsonTextarea value={`${safeJsonStringify(response)}\n`} onChange={() => {}} rows={14} />
        </div>
        <div className="mt-3 text-xs text-zinc-600">请求会发送到 `{gatewayBaseUrl}/v1/tools/:toolName:invoke`。</div>
      </div>
    </div>
  );
}
