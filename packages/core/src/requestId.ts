import { randomUUID } from "node:crypto";

export function ensureRequestId(existing?: string | string[]) {
  if (Array.isArray(existing)) return existing[0] ?? randomUUID();
  return existing ?? randomUUID();
}

