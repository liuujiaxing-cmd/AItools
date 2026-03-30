import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Clipboard, ExternalLink, KeyRound, ShieldCheck, Sparkles, Wrench } from "lucide-react";

import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import JsonTextarea from "@/components/JsonTextarea";
import { getDemoToken, getErrorCatalog } from "@/api/toolset";
import { usePortalStore } from "@/store/portalStore";
import { copyToClipboard } from "@/utils/clipboard";
import { getErrorMessage } from "@/utils/errors";
import { safeJsonStringify } from "@/utils/json";

type ErrorCatalogItem = {
  code: string;
  message: { zh: string; en: string };
};

type DocSection = {
  id: string;
  title: string;
};

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <BookOpen className="h-4 w-4 text-zinc-700" />
      <div className="text-base font-semibold text-zinc-900">{title}</div>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-zinc-200 bg-white p-4">{children}</div>;
}

function ActionButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
    >
      <Clipboard className="h-4 w-4" />
      {label}
    </button>
  );
}

export default function Docs() {
  const { gatewayBaseUrl, bearerToken, setBearerToken } = usePortalStore();
  const [notice, setNotice] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [loadingToken, setLoadingToken] = useState(false);
  const [errors, setErrors] = useState<ErrorCatalogItem[]>([]);

  const sections: DocSection[] = useMemo(
    () => [
      { id: "overview", title: "系统概览" },
      { id: "quickstart", title: "快速开始" },
      { id: "call-format", title: "工具调用格式" },
      { id: "auth", title: "鉴权与 Token" },
      { id: "one-click", title: "一键调用与复制" },
      { id: "tool-dev", title: "如何添加新工具" },
      { id: "deploy", title: "部署与运维" },
      { id: "sdks", title: "SDK 与示例" },
      { id: "ops", title: "监控与排障" },
      { id: "errors", title: "错误码" },
      { id: "faq", title: "常见问题" }
    ],
    []
  );

  useEffect(() => {
    let alive = true;
    setErr("");
    getErrorCatalog(gatewayBaseUrl)
      .then((r) => {
        if (!alive) return;
        setErrors((r.errors ?? []) as ErrorCatalogItem[]);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setErr(getErrorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [gatewayBaseUrl]);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) return;
    window.setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, []);

  async function copy(text: string, label: string) {
    await copyToClipboard(text);
    setNotice(`已复制：${label}`);
    window.setTimeout(() => setNotice(""), 1500);
  }

  function jump(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  }

  async function onGetDemoToken() {
    setErr("");
    setLoadingToken(true);
    try {
      const r = await getDemoToken(gatewayBaseUrl);
      setBearerToken(r.access_token);
      setNotice("已获取 Demo Token");
      window.setTimeout(() => setNotice(""), 1500);
    } catch (e: unknown) {
      setErr(getErrorMessage(e));
    } finally {
      setLoadingToken(false);
    }
  }

  const invokeRequestExample = useMemo(
    () =>
      safeJsonStringify({
        input: { text: "hello" },
        context: { trace_id: "t1" },
        options: {}
      }),
    []
  );

  const invokeResponseExample = useMemo(
    () =>
      safeJsonStringify({
        output: { text: "hello" },
        meta: { tool: "echo", request_id: "..." }
      }),
    []
  );

  const curlGetToken = useMemo(() => {
    return `curl -sS -X POST ${gatewayBaseUrl}/v1/oauth/token \\\n+  -H 'content-type: application/json' \\\n+  -d '{"client_id":"demo","client_secret":"demo"}'\n`;
  }, [gatewayBaseUrl]);

  const curlListTools = useMemo(() => {
    return `curl -sS ${gatewayBaseUrl}/v1/tools\n`;
  }, [gatewayBaseUrl]);

  const curlInvokeEcho = useMemo(() => {
    const auth = bearerToken ? `  -H 'authorization: Bearer ${bearerToken}' \\\n+` : "";
    return `curl -sS -X POST ${gatewayBaseUrl}/v1/tools/echo:invoke \\\n+  -H 'content-type: application/json' \\\n+${auth}  -d '{"input":{"text":"hello"}}'\n`;
  }, [gatewayBaseUrl, bearerToken]);

  const toolTemplate = useMemo(() => {
    return `export const tool = {
  metadata() {
    return {
      name: "my_tool",
      version: "1.0.0",
      description: "Describe what this tool does",
      input_schema: {
        type: "object",
        properties: {
          text: { type: "string" }
        },
        required: ["text"]
      },
      output_schema: {
        type: "object",
        properties: {
          result: { type: "string" }
        }
      },
      tags: ["demo"]
    };
  },
  async invoke(input, ctx) {
    return { result: String(input.text ?? "") };
  }
};
`;
  }, []);

  const registerExample = useMemo(() => {
    return safeJsonStringify({
      file_name: "my_tool.mjs",
      source_code: toolTemplate
    });
  }, [toolTemplate]);

  const jsFetchExample = useMemo(() => {
    return `const baseUrl = "${gatewayBaseUrl}";

async function invokeEcho(token) {
  const r = await fetch(baseUrl + "/v1/tools/echo:invoke", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: "Bearer " + token } : {})
    },
    body: JSON.stringify({ input: { text: "hello" }, context: {}, options: {} })
  });
  return await r.json();
}
`;
  }, [gatewayBaseUrl]);

  const pythonExample = useMemo(() => {
    return `import requests

base = "${gatewayBaseUrl}"

token = requests.post(
    f"{base}/v1/oauth/token",
    json={"client_id": "demo", "client_secret": "demo"},
    timeout=10,
).json()["access_token"]

r = requests.post(
    f"{base}/v1/tools/echo:invoke",
    headers={"authorization": f"Bearer {token}"},
    json={"input": {"text": "hello"}, "context": {}, "options": {}},
    timeout=10,
)
print(r.json())
`;
  }, [gatewayBaseUrl]);

  if (err) return <EmptyState title="文档加载失败" description={err} />;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-5 rounded-xl border border-zinc-200 bg-white p-3">
          <div className="text-xs font-semibold text-zinc-700">目录</div>
          <div className="mt-2 space-y-1">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => jump(s.id)}
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="space-y-4">
        {notice ? <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">{notice}</div> : null}

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          这是“文档中心”（门户内置页面，不是 Swagger）。如果你想看接口详情/在线试接口，请点右上角的 Swagger。
        </div>

        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-zinc-900">当前网关</div>
            <Badge tone="neutral">{gatewayBaseUrl}</Badge>
            <a
              href={`${gatewayBaseUrl}/docs`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              <ExternalLink className="h-4 w-4" />
              Swagger
            </a>
          </div>
        </Card>

        <Card>
          <div id="overview" className="scroll-mt-20">
            <SectionTitle title="系统概览" />
            <div className="mt-3 space-y-3 text-sm text-zinc-700">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                组件：Gateway（统一入口） → Runtime（工具运行时） + Registry（注册中心）。对外只暴露 Gateway，更安全。
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs">
                  网关：`{gatewayBaseUrl}`
                  <div className="mt-1 text-zinc-500">/healthz /docs /v1/tools</div>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs">
                  门户：`{window.location.origin}`
                  <div className="mt-1 text-zinc-500">工具列表 / 在线调用 / 文档</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div id="quickstart" className="scroll-mt-20">
            <SectionTitle title="快速开始" />
            <div className="mt-3 space-y-3">
              <div>入口：</div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs">门户：{window.location.origin}</div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs">网关：{gatewayBaseUrl}</div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs font-semibold text-zinc-700">复制即可用（推荐）</div>
                  <ActionButton label="复制：列出工具" onClick={() => copy(curlListTools, "列出工具")} />
                  <ActionButton label="复制：调用 echo" onClick={() => copy(curlInvokeEcho, "调用 echo")} />
                  <div className="ml-auto" />
                </div>
                <div className="mt-2">
                  <JsonTextarea value={curlInvokeEcho} onChange={() => {}} rows={5} />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div id="call-format" className="scroll-mt-20">
            <SectionTitle title="工具调用格式" />
            <div className="mt-3 space-y-3">
              <div className="text-sm text-zinc-700">统一请求体：</div>
              <JsonTextarea value={invokeRequestExample} onChange={() => {}} rows={8} />
              <div className="text-sm text-zinc-700">统一响应体：</div>
              <JsonTextarea value={invokeResponseExample} onChange={() => {}} rows={8} />
            </div>
          </div>
        </Card>

        <Card>
          <div id="auth" className="scroll-mt-20">
            <SectionTitle title="鉴权与 Token" />
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={bearerToken ? "blue" : "neutral"}>{bearerToken ? "Bearer 已设置" : "Bearer 未设置"}</Badge>
                <button
                  type="button"
                  disabled={loadingToken}
                  onClick={onGetDemoToken}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                >
                  <KeyRound className="h-4 w-4" />
                  获取 Demo Token
                </button>
                <ActionButton label="复制：获取 Token cURL" onClick={() => copy(curlGetToken, "获取 Token")} />
              </div>
              <JsonTextarea value={curlGetToken} onChange={() => {}} rows={4} />
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <ShieldCheck className="mr-2 inline h-4 w-4" />
                生产环境建议关闭 Demo Token，改用你自己的 OAuth/用户体系，或启用 API Key + 签名校验。
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div id="one-click" className="scroll-mt-20">
            <SectionTitle title="一键调用与复制" />
            <div className="mt-3 space-y-2">
              <div>门户已提供：</div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-700">
                <Sparkles className="h-4 w-4" />
                在线调用页：一键示例调用、复制 cURL（含/不含 Token）。
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-700">
                <Wrench className="h-4 w-4" />
                工具详情页：一键示例调用、复制 cURL。
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
                备注：门户是 https 时，网关也必须是 https，否则浏览器会拦截请求（Mixed Content）。
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div id="tool-dev" className="scroll-mt-20">
            <SectionTitle title="如何添加新工具" />
            <div className="mt-3 space-y-3">
              <div className="text-sm">1) 写一个工具文件（ESM，导出 `tool`）</div>
              <JsonTextarea value={toolTemplate} onChange={() => {}} rows={18} />
              <div className="text-sm">2) 动态注册（无需重启）</div>
              <div className="text-xs text-zinc-600">向 Runtime 的 `/v1/tools/register` 提交源码即可加载。</div>
              <JsonTextarea value={registerExample} onChange={() => {}} rows={10} />
            </div>
          </div>
        </Card>

        <Card>
          <div id="deploy" className="scroll-mt-20">
            <SectionTitle title="部署与运维" />
            <div className="mt-3 space-y-3">
              <div className="text-sm">推荐用子域名隔离主站：</div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs">门户：`toolset.jiaaxing.cn`</div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs">网关：`toolset-api.jiaaxing.cn`</div>
              </div>
              <div className="text-sm">健康检查：</div>
              <JsonTextarea value={`curl -sS ${gatewayBaseUrl}/healthz\n`} onChange={() => {}} rows={2} />
              <div className="text-sm">日志：</div>
              <JsonTextarea
                value={`sudo systemctl status toolset-gateway --no-pager\nsudo journalctl -u toolset-gateway -n 200 --no-pager\n`}
                onChange={() => {}}
                rows={4}
              />
            </div>
          </div>
        </Card>

        <Card>
          <div id="sdks" className="scroll-mt-20">
            <SectionTitle title="SDK 与示例" />
            <div className="mt-3 space-y-3">
              <div className="text-sm text-zinc-700">仓库里提供了最小可用的多语言示例客户端（位于 `sdks/`）。</div>
              <div className="rounded-lg border border-zinc-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-zinc-700">JavaScript fetch 示例</div>
                  <ActionButton label="复制" onClick={() => copy(jsFetchExample, "JS 示例")} />
                </div>
                <div className="mt-2">
                  <JsonTextarea value={jsFetchExample} onChange={() => {}} rows={14} />
                </div>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-zinc-700">Python requests 示例</div>
                  <ActionButton label="复制" onClick={() => copy(pythonExample, "Python 示例")} />
                </div>
                <div className="mt-2">
                  <JsonTextarea value={pythonExample} onChange={() => {}} rows={16} />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div id="ops" className="scroll-mt-20">
            <SectionTitle title="监控与排障" />
            <div className="mt-3 space-y-3">
              <div className="text-sm text-zinc-700">常用检查：</div>
              <JsonTextarea
                value={`# 网关健康\ncurl -sS ${gatewayBaseUrl}/healthz\n\n# 工具列表\ncurl -sS ${gatewayBaseUrl}/v1/tools\n\n# 网关日志（Ubuntu）\nsudo journalctl -u toolset-gateway -n 200 --no-pager\n`}
                onChange={() => {}}
                rows={10}
              />
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
                如果你把门户放在 https，网关也必须是 https；否则会出现 Failed to fetch（浏览器拦截混合内容）。
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div id="errors" className="scroll-mt-20">
            <SectionTitle title="错误码" />
            <div className="mt-3 space-y-3">
              <div className="text-xs text-zinc-600">错误码来自网关：`GET /v1/docs/errors`</div>
              {errors.length === 0 ? (
                <div className="text-sm text-zinc-600">加载中…</div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-zinc-200">
                  <table className="w-full table-fixed border-collapse text-xs">
                    <thead className="bg-zinc-50 text-zinc-600">
                      <tr>
                        <th className="w-40 px-3 py-2 text-left">code</th>
                        <th className="px-3 py-2 text-left">zh</th>
                        <th className="px-3 py-2 text-left">en</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {errors.slice(0, 120).map((e) => (
                        <tr key={e.code} className="border-t border-zinc-100">
                          <td className="px-3 py-2 font-mono text-zinc-900">{e.code}</td>
                          <td className="px-3 py-2 text-zinc-700">{e.message?.zh}</td>
                          <td className="px-3 py-2 text-zinc-700">{e.message?.en}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <div id="faq" className="scroll-mt-20">
            <SectionTitle title="常见问题" />
            <div className="mt-3 space-y-3 text-sm text-zinc-700">
              <div>
                <div className="font-semibold">1) 门户显示网关离线 / Failed to fetch</div>
                <div className="mt-1 text-xs text-zinc-600">通常是 https 门户访问了 http 网关（Mixed Content），把网关 Base URL 改成 https。</div>
              </div>
              <div>
                <div className="font-semibold">2) 访问 `toolset-api.*` 根路径是 404</div>
                <div className="mt-1 text-xs text-zinc-600">正常现象。用 `/healthz` 或 `/docs`。</div>
              </div>
              <div>
                <div className="font-semibold">3) Runtime/Registry 文档打不开</div>
                <div className="mt-1 text-xs text-zinc-600">默认不对公网开放（更安全）。需要的话可以通过网关做代理或加鉴权后开放。</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
