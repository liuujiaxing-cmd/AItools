import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, FileText, Play, Wrench } from "lucide-react";

import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import { getTools, ToolRecord } from "@/api/toolset";
import { usePortalStore } from "@/store/portalStore";
import { getErrorMessage } from "@/utils/errors";

function StatCard({
  title,
  value,
  hint
}: {
  title: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="text-xs font-medium text-zinc-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-xs text-zinc-600">{hint}</div> : null}
    </div>
  );
}

export default function Home() {
  const { gatewayBaseUrl, bearerToken } = usePortalStore();
  const [tools, setTools] = useState<ToolRecord[] | null>(null);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    let alive = true;
    setTools(null);
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

  const stats = useMemo(() => {
    const list = tools ?? [];
    const total = list.length;
    const ready = list.filter((t) => t.status === "ready").length;
    const error = list.filter((t) => t.status !== "ready").length;
    return { total, ready, error };
  }, [tools]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold">面向 AI 的工具集调用门户</div>
            <div className="mt-1 text-sm text-zinc-600">
              展示系统概览、工具列表与详情、在线调用演示，并提供 API 文档与监控入口。
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone="blue">OpenAPI / Swagger</Badge>
              <Badge tone="blue">JWT / API Key</Badge>
              <Badge tone="blue">Rate Limit</Badge>
              <Badge tone="blue">Metrics</Badge>
              <Badge tone="blue">Hot Reload</Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/tools"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
            >
              <Wrench className="h-4 w-4" />
              浏览工具
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/playground"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              <Play className="h-4 w-4" />
              在线调用
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="工具总数" value={tools ? stats.total : "—"} hint="来自 Gateway → Runtime" />
        <StatCard title="可用工具" value={tools ? stats.ready : "—"} hint="status = ready" />
        <StatCard title="异常/未就绪" value={tools ? stats.error : "—"} hint="loading / error 等" />
      </div>

      {err ? (
        <EmptyState
          title="无法加载工具列表"
          description={err}
          action={
            <a
              href={`${gatewayBaseUrl}/docs`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <FileText className="h-4 w-4" />
              打开 API 文档
            </a>
          }
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold">快速入口</div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <a
              href={`${gatewayBaseUrl}/docs`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Gateway Swagger UI
              </span>
              <ArrowRight className="h-4 w-4 text-zinc-400" />
            </a>
            <a
              href={`${gatewayBaseUrl}/metrics`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4" /> Gateway Metrics
              </span>
              <ArrowRight className="h-4 w-4 text-zinc-400" />
            </a>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold">调用约定（UI 演示）</div>
          <div className="mt-2 text-sm text-zinc-600">
            在线调用统一走 `POST /v1/tools/:toolName:invoke`，请求体使用 `input/context/options`。Bearer Token（可选）用于演示 JWT。
          </div>
          <div className="mt-3">
            <Link
              to="/links"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              查看全部文档与监控入口
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
