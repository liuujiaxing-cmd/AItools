import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Activity, FileText, LayoutGrid, Play, Settings, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";
import Badge from "@/components/Badge";
import { getHealthz } from "@/api/toolset";
import { usePortalStore } from "@/store/portalStore";
import { getErrorMessage } from "@/utils/errors";

function NavItem({
  to,
  icon,
  label
}: {
  to: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
          isActive ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
        )
      }
    >
      <span className="h-4 w-4">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export default function AppShell() {
  const location = useLocation();
  const {
    gatewayBaseUrl,
    runtimeBaseUrl,
    registryBaseUrl,
    bearerToken,
    setGatewayBaseUrl,
    setRuntimeBaseUrl,
    setRegistryBaseUrl,
    setBearerToken,
    clearBearerToken
  } = usePortalStore();

  const [health, setHealth] = useState<{ ok: boolean } | null>(null);
  const [healthError, setHealthError] = useState<string>("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const title = useMemo(() => {
    const p = location.pathname;
    if (p.startsWith("/tools")) return "工具";
    if (p.startsWith("/playground")) return "在线调用";
    if (p.startsWith("/docs")) return "文档";
    if (p.startsWith("/links")) return "文档与监控";
    return "系统概览";
  }, [location.pathname]);

  useEffect(() => {
    let alive = true;
    setHealth(null);
    setHealthError("");
    getHealthz(gatewayBaseUrl)
      .then((r) => {
        if (!alive) return;
        setHealth(r);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setHealthError(getErrorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [gatewayBaseUrl]);

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-0 px-4 py-4 md:grid-cols-[240px_1fr] md:gap-4">
        <aside className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between px-2 py-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 text-white">
                <Wrench className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">工具集门户</div>
                <div className="text-xs text-zinc-500">openclaw toolset</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700",
                "hover:bg-zinc-50"
              )}
              aria-label="设置"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 space-y-1">
            <NavItem to="/" icon={<LayoutGrid className="h-4 w-4" />} label="概览" />
            <NavItem to="/tools" icon={<Wrench className="h-4 w-4" />} label="工具" />
            <NavItem to="/playground" icon={<Play className="h-4 w-4" />} label="在线调用" />
            <NavItem to="/docs" icon={<FileText className="h-4 w-4" />} label="文档" />
          </div>

          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-zinc-700">网关状态</div>
              {health?.ok ? <Badge tone="green">在线</Badge> : healthError ? <Badge tone="red">离线</Badge> : <Badge tone="yellow">检测中</Badge>}
            </div>
            <div className="mt-2 text-xs text-zinc-600">{gatewayBaseUrl}</div>
            {healthError ? <div className="mt-2 text-xs text-rose-700">{healthError}</div> : null}
            <div className="mt-3 flex items-center gap-2">
              <Badge tone={bearerToken ? "blue" : "neutral"}>{bearerToken ? "已设置 Token" : "未设置 Token"}</Badge>
              <a
                href={`${gatewayBaseUrl}/metrics`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-zinc-700 hover:text-zinc-900"
              >
                <Activity className="h-3.5 w-3.5" />
                metrics
              </a>
            </div>
          </div>

          {settingsOpen ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
              <div className="text-xs font-semibold text-zinc-700">连接配置</div>
              <div className="mt-3 grid grid-cols-1 gap-3">
                <div>
                  <div className="text-xs font-medium text-zinc-700">Gateway</div>
                  <input
                    value={gatewayBaseUrl}
                    onChange={(e) => setGatewayBaseUrl(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-zinc-300 focus:ring-2 focus:ring-zinc-200"
                    placeholder="http://localhost:8080"
                  />
                </div>
                <div>
                  <div className="text-xs font-medium text-zinc-700">Runtime</div>
                  <input
                    value={runtimeBaseUrl}
                    onChange={(e) => setRuntimeBaseUrl(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-zinc-300 focus:ring-2 focus:ring-zinc-200"
                    placeholder="http://localhost:8081"
                  />
                </div>
                <div>
                  <div className="text-xs font-medium text-zinc-700">Registry</div>
                  <input
                    value={registryBaseUrl}
                    onChange={(e) => setRegistryBaseUrl(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-zinc-300 focus:ring-2 focus:ring-zinc-200"
                    placeholder="http://localhost:8082"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-zinc-700">Bearer Token</div>
                    <button
                      type="button"
                      onClick={clearBearerToken}
                      className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
                    >
                      清除
                    </button>
                  </div>
                  <input
                    value={bearerToken}
                    onChange={(e) => setBearerToken(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-zinc-300 focus:ring-2 focus:ring-zinc-200"
                    placeholder="可选：用于演示 JWT 认证"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </aside>

        <main className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-zinc-500">{location.pathname}</div>
              <h1 className="mt-1 text-lg font-semibold">{title}</h1>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <a
                href={`${gatewayBaseUrl}/docs`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
              >
                <FileText className="h-4 w-4" />
                API Docs
              </a>
              <a
                href={`${gatewayBaseUrl}/metrics`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
              >
                <Activity className="h-4 w-4" />
                Metrics
              </a>
            </div>
          </div>
          <div className="mt-5">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
