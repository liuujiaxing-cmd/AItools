import type { ReactNode } from "react";
import { Activity, ExternalLink, FileText, Server } from "lucide-react";

import { usePortalStore } from "@/store/portalStore";

function LinkRow({
  label,
  url,
  icon,
  disabled,
  note
}: {
  label: string;
  url: string;
  icon: ReactNode;
  disabled?: boolean;
  note?: string;
}) {
  const inner = (
    <>
      <span className="flex items-center gap-2">
        <span className="h-4 w-4 text-zinc-500">{icon}</span>
        <span className="font-medium">{label}</span>
        <span className="truncate text-xs text-zinc-500">{note ?? url}</span>
      </span>
      <ExternalLink className="h-4 w-4 text-zinc-400" />
    </>
  );

  if (disabled) {
    return <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 shadow-sm">{inner}</div>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm hover:bg-zinc-50"
    >
      {inner}
    </a>
  );
}

export default function Links() {
  const { gatewayBaseUrl, runtimeBaseUrl, registryBaseUrl } = usePortalStore();

  const runtimeInternal = runtimeBaseUrl.includes("localhost") || runtimeBaseUrl.includes("127.0.0.1") || !runtimeBaseUrl;
  const registryInternal = registryBaseUrl.includes("localhost") || registryBaseUrl.includes("127.0.0.1") || !registryBaseUrl;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
        入口使用当前“连接配置”中的 Base URL 生成。若你使用 `docker-compose`，Grafana 默认 `http://localhost:3000`，Prometheus 默认 `http://localhost:9090`。
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="text-sm font-semibold">API 文档</div>
        <LinkRow label="Gateway Swagger UI" url={`${gatewayBaseUrl}/docs`} icon={<FileText className="h-4 w-4" />} />
        <LinkRow
          label="Runtime Swagger UI"
          url={`${runtimeBaseUrl}/docs`}
          icon={<FileText className="h-4 w-4" />}
          disabled={runtimeInternal}
          note={runtimeInternal ? "默认不对公网开放（服务器内网）" : undefined}
        />
        <LinkRow
          label="Registry Swagger UI"
          url={`${registryBaseUrl}/docs`}
          icon={<FileText className="h-4 w-4" />}
          disabled={registryInternal}
          note={registryInternal ? "默认不对公网开放（服务器内网）" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="text-sm font-semibold">监控与运维</div>
        <LinkRow label="Gateway Metrics" url={`${gatewayBaseUrl}/metrics`} icon={<Activity className="h-4 w-4" />} />
        <LinkRow
          label="Runtime Metrics"
          url={`${runtimeBaseUrl}/metrics`}
          icon={<Activity className="h-4 w-4" />}
          disabled={runtimeInternal}
          note={runtimeInternal ? "默认不对公网开放（服务器内网）" : undefined}
        />
        <LinkRow
          label="Registry Metrics"
          url={`${registryBaseUrl}/metrics`}
          icon={<Activity className="h-4 w-4" />}
          disabled={registryInternal}
          note={registryInternal ? "默认不对公网开放（服务器内网）" : undefined}
        />
        <LinkRow label="Gateway Healthz" url={`${gatewayBaseUrl}/healthz`} icon={<Server className="h-4 w-4" />} />
        <LinkRow
          label="Runtime Healthz"
          url={`${runtimeBaseUrl}/healthz`}
          icon={<Server className="h-4 w-4" />}
          disabled={runtimeInternal}
          note={runtimeInternal ? "默认不对公网开放（服务器内网）" : undefined}
        />
        <LinkRow
          label="Registry Healthz"
          url={`${registryBaseUrl}/healthz`}
          icon={<Server className="h-4 w-4" />}
          disabled={registryInternal}
          note={registryInternal ? "默认不对公网开放（服务器内网）" : undefined}
        />
        <LinkRow label="Prometheus" url="http://localhost:9090" icon={<Activity className="h-4 w-4" />} />
        <LinkRow label="Grafana" url="http://localhost:3000" icon={<Activity className="h-4 w-4" />} />
      </div>
    </div>
  );
}
