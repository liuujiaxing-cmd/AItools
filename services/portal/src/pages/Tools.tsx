import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Wrench } from "lucide-react";

import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import { getTools, ToolRecord } from "@/api/toolset";
import { usePortalStore } from "@/store/portalStore";
import { getErrorMessage } from "@/utils/errors";

function statusTone(status: string): "neutral" | "green" | "red" | "yellow" | "blue" {
  if (status === "ready") return "green";
  if (status === "loading") return "yellow";
  if (status === "error") return "red";
  return "neutral";
}

export default function Tools() {
  const { gatewayBaseUrl, bearerToken } = usePortalStore();
  const [tools, setTools] = useState<ToolRecord[] | null>(null);
  const [err, setErr] = useState<string>("");
  const [q, setQ] = useState("");

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

  const filtered = useMemo(() => {
    const list = tools ?? [];
    const keyword = q.trim().toLowerCase();
    if (!keyword) return list;
    return list.filter((t) => {
      const m = t.metadata;
      return (
        m.name.toLowerCase().includes(keyword) ||
        String(m.description ?? "").toLowerCase().includes(keyword) ||
        String(m.version ?? "").toLowerCase().includes(keyword) ||
        (m.tags ?? []).some((x) => x.toLowerCase().includes(keyword))
      );
    });
  }, [tools, q]);

  if (err) {
    return <EmptyState title="无法加载工具列表" description={err} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-zinc-600">{tools ? `共 ${tools.length} 个工具` : "加载中…"}</div>
        <div className="relative w-full md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索名称 / 描述 / tag"
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-3 text-sm shadow-sm outline-none focus:border-zinc-300 focus:ring-2 focus:ring-zinc-200"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {filtered.map((t) => (
          <Link
            key={t.metadata.name}
            to={`/tools/${encodeURIComponent(t.metadata.name)}`}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:bg-zinc-50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{t.metadata.name}</div>
                    <div className="mt-0.5 truncate text-xs text-zinc-600">{t.metadata.description ?? "—"}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                  <Badge>{t.metadata.version}</Badge>
                  {(t.metadata.tags ?? []).slice(0, 3).map((tag) => (
                    <Badge key={tag} tone="neutral">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="shrink-0 text-xs text-zinc-500">查看详情</div>
            </div>
          </Link>
        ))}
      </div>

      {tools && filtered.length === 0 ? <EmptyState title="没有匹配的工具" description="调整关键词或清空搜索再试。" /> : null}
    </div>
  );
}
