import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function Badge({
  children,
  tone = "neutral",
  className
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "red" | "yellow" | "blue";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-zinc-100 text-zinc-700 ring-zinc-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    yellow: "bg-amber-50 text-amber-800 ring-amber-200",
    blue: "bg-sky-50 text-sky-800 ring-sky-200"
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
