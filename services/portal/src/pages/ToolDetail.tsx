import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileText, Play, Wrench } from "lucide-react";

import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import JsonTextarea from "@/components/JsonTextarea";
import { getTool, getToolDocs, ToolDetailResponse, ToolDocsResponse } from "@/api/toolset";
import { usePortalStore } from "@/store/portalStore";
import { getErrorMessage } from "@/utils/errors";
import { safeJsonStringify } from "@/utils/json";

function statusTone(status: string): "neutral" | "green" | "red" | "yellow" | "blue" {
  if (status === "ready") return "green";
  if (status === "loading") return "yellow";
  if (status === "error") return "red";
  return "neutral";
}

export default function ToolDetail() {
  const { toolName } = useParams();
  const [searchParams] = useSearchParams();
  const { gatewayBaseUrl, bearerToken } = usePortalStore();

  const [detail, setDetail] = useState<ToolDetailResponse | null>(null);
  const [docs, setDocs] = useState<ToolDocsResponse | null>(null);
  const [err, setErr] = useState<string>("");
  const [tab, setTab] = useState<"meta" | "schema" | "docs">("meta");

  const name = String(toolName ?? "");
  const autoTab = searchParams.get("tab");

  useEffect(() => {
    if (!name) return;
    if (autoTab === "schema" || autoTab === "docs" || autoTab === "meta") setTab(autoTab);
  }, [autoTab, name]);

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setDocs(null);
    setErr("");
    if (!name) return;

    Promise.all([getTool(gatewayBaseUrl, name, bearerToken), getToolDocs(gatewayBaseUrl, name, bearerToken)])
      .then(([d, doc]) => {
        if (!alive) return;
        setDetail(d);
        setDocs(doc);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setErr(getErrorMessage(e));
      });

    return () => {
      alive = false;
    };
  }, [gatewayBaseUrl, bearerToken, name]);

  const meta = detail?.tool.metadata;
  const status = detail?.tool.status;
  const schemaText = useMemo(() => safeJsonStringify({ input_schema: meta?.input_schema, output_schema: meta?.output_schema }), [meta]);
  const docsText = useMemo(() => safeJsonStringify(docs), [docs]);

  if (!name) return <EmptyState title="未指定工具" description="从工具列表进入该页面。" />;
  if (err) return <EmptyState title="无法加载工具详情" description={err} />;
  if (!detail || !meta) return <div className="text-sm text-zinc-600">加载中…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/tools"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </Link>
        <div className="flex items-center gap-2">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <Wrench className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">{meta.name}</div>
            <div className="text-xs text-zinc-600">{meta.description ?? "—"}</div>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(status ?? "")}>{status ?? "—"}</Badge>
          <Badge>{meta.version}</Badge>
          <Link
            to={`/playground?tool=${encodeURIComponent(meta.name)}`}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <Play className="h-4 w-4" />
            在线调用
          </Link>
          <a
            href={`${gatewayBaseUrl}/docs`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <FileText className="h-4 w-4" />
            API 文档
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("meta")}
          className={
            tab === "meta"
              ? "h-9 rounded-lg bg-zinc-900 px-3 text-sm font-semibold text-white"
              : "h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          }
        >
          元数据
        </button>
        <button
          type="button"
          onClick={() => setTab("schema")}
          className={
            tab === "schema"
              ? "h-9 rounded-lg bg-zinc-900 px-3 text-sm font-semibold text-white"
              : "h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          }
        >
          Schema
        </button>
        <button
          type="button"
          onClick={() => setTab("docs")}
          className={
            tab === "docs"
              ? "h-9 rounded-lg bg-zinc-900 px-3 text-sm font-semibold text-white"
              : "h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          }
        >
          示例与文档
        </button>
      </div>

      {tab === "meta" ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium text-zinc-500">name</div>
              <div className="mt-1 text-sm font-semibold">{meta.name}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-500">version</div>
              <div className="mt-1 text-sm font-semibold">{meta.version}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs font-medium text-zinc-500">description</div>
              <div className="mt-1 text-sm text-zinc-700">{meta.description ?? "—"}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs font-medium text-zinc-500">tags</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(meta.tags ?? []).length === 0 ? <div className="text-sm text-zinc-600">—</div> : null}
                {(meta.tags ?? []).map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
            </div>
            {detail.tool.last_error ? (
              <div className="md:col-span-2">
                <div className="text-xs font-medium text-zinc-500">last_error</div>
                <div className="mt-2">
                  <JsonTextarea value={safeJsonStringify(detail.tool.last_error)} onChange={() => {}} rows={8} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "schema" ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold">input_schema / output_schema</div>
          <div className="mt-3">
            <JsonTextarea value={schemaText} onChange={() => {}} rows={18} />
          </div>
        </div>
      ) : null}

      {tab === "docs" ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold">request/response 示例（来自 Runtime docs）</div>
          <div className="mt-3">
            <JsonTextarea value={docsText} onChange={() => {}} rows={18} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
