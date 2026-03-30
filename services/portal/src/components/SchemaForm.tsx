import { cn } from "@/lib/utils";

type JsonSchema = {
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: Array<string | number | boolean | null>;
  default?: unknown;
};

function isObjectSchema(s: unknown): s is JsonSchema {
  return !!s && typeof s === "object";
}

function getPrimitiveType(s: JsonSchema) {
  if (Array.isArray(s.enum) && s.enum.length > 0) return "enum";
  if (s.type === "integer" || s.type === "number") return "number";
  if (s.type === "boolean") return "boolean";
  return "string";
}

export default function SchemaForm({
  schema,
  value,
  onChange
}: {
  schema: unknown;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  if (!isObjectSchema(schema) || schema.type !== "object" || !schema.properties) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-600">
        当前工具未提供可解析的 `input_schema`，请使用 JSON 模式。
      </div>
    );
  }

  const required = new Set(schema.required ?? []);
  const entries = Object.entries(schema.properties);
  if (entries.length === 0) {
    return <div className="rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-600">无输入字段</div>;
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {entries.map(([k, s]) => {
          const field = s ?? {};
          const t = getPrimitiveType(field);
          const label = field.title ?? k;
          const v = value[k];

          return (
            <div key={k} className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-zinc-900">{label}</div>
                {required.has(k) ? (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
                    必填
                  </span>
                ) : null}
              </div>
              {field.description ? <div className="mt-1 text-xs text-zinc-600">{field.description}</div> : null}
              <div className="mt-2">
                {t === "boolean" ? (
                  <label className="flex select-none items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={Boolean(v)}
                      onChange={(e) => onChange({ ...value, [k]: e.target.checked })}
                      className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
                    />
                    {k}
                  </label>
                ) : t === "enum" ? (
                  <select
                    aria-label={label}
                    value={String(v ?? "")}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const match = (field.enum ?? []).find((x) => String(x) === raw);
                      onChange({ ...value, [k]: match ?? raw });
                    }}
                    className={cn(
                      "h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none",
                      "focus:border-zinc-300 focus:ring-2 focus:ring-zinc-200"
                    )}
                  >
                    <option value="">请选择</option>
                    {(field.enum ?? []).map((x) => (
                      <option key={String(x)} value={String(x)}>
                        {String(x)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={t === "number" ? "number" : "text"}
                    aria-label={label}
                    value={v === undefined || v === null ? "" : String(v)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const next = t === "number" ? (raw === "" ? undefined : Number(raw)) : raw;
                      onChange({ ...value, [k]: next });
                    }}
                    className={cn(
                      "h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none",
                      "focus:border-zinc-300 focus:ring-2 focus:ring-zinc-200"
                    )}
                    placeholder={field.default === undefined ? "" : String(field.default)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
