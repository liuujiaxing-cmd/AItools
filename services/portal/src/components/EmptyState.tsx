import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function EmptyState({
  title,
  description,
  action,
  className
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-zinc-200 bg-white p-6", className)}>
      <div className="text-sm font-semibold text-zinc-900">{title}</div>
      {description ? <div className="mt-1 text-sm text-zinc-600">{description}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
