import { cn } from "@/lib/utils";

export default function JsonTextarea({
  value,
  onChange,
  placeholder,
  rows = 10,
  className
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      spellCheck={false}
      className={cn(
        "w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900 shadow-sm outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-200",
        className
      )}
    />
  );
}
