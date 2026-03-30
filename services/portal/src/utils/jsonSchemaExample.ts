type JsonSchema = Record<string, any>;

function firstDefined<T>(...vals: Array<T | undefined | null>): T | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}

function normalizeSchema(schema: unknown): JsonSchema | null {
  if (!schema || typeof schema !== "object") return null;
  return schema as JsonSchema;
}

export function inferExampleFromJsonSchema(schema: unknown, depth = 0): unknown {
  if (depth > 6) return null;
  const s = normalizeSchema(schema);
  if (!s) return null;

  const direct = firstDefined(s.const, s.default);
  if (direct !== undefined) return direct;

  if (Array.isArray(s.examples) && s.examples.length > 0) return s.examples[0];
  if (Array.isArray(s.enum) && s.enum.length > 0) return s.enum[0];

  const picked = firstDefined(
    Array.isArray(s.oneOf) ? s.oneOf[0] : undefined,
    Array.isArray(s.anyOf) ? s.anyOf[0] : undefined,
    Array.isArray(s.allOf) ? s.allOf[0] : undefined
  );
  if (picked) return inferExampleFromJsonSchema(picked, depth + 1);

  const t = typeof s.type === "string" ? s.type : undefined;
  if (t === "string") return "";
  if (t === "number" || t === "integer") return 0;
  if (t === "boolean") return false;
  if (t === "null") return null;

  if (t === "array") {
    const item = inferExampleFromJsonSchema(s.items, depth + 1);
    return item === undefined ? [] : [item];
  }

  if (t === "object" || s.properties) {
    const props = (s.properties && typeof s.properties === "object" ? s.properties : {}) as Record<string, unknown>;
    const required = Array.isArray(s.required) ? (s.required as string[]) : [];
    const out: Record<string, unknown> = {};
    const keys = required.length > 0 ? required : Object.keys(props).slice(0, 3);
    for (const k of keys) {
      if (!(k in props)) continue;
      out[k] = inferExampleFromJsonSchema(props[k], depth + 1);
    }
    return out;
  }

  return {};
}

