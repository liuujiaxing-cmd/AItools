import crypto from "node:crypto";
import { ToolsetError } from "./errors";

export function computeSignature(params: {
  secret: string;
  method: string;
  path: string;
  ts: string;
  nonce: string;
  body: Buffer;
}) {
  const hash = crypto.createHash("sha256").update(params.body).digest("hex");
  const msg = [params.method.toUpperCase(), params.path, params.ts, params.nonce, hash].join("\n");
  return crypto.createHmac("sha256", params.secret).update(msg).digest("hex");
}

export function verifySignature(params: {
  secret: string;
  provided: string;
  method: string;
  path: string;
  ts: string;
  nonce: string;
  body: Buffer;
  maxSkewSeconds?: number;
}) {
  const maxSkew = params.maxSkewSeconds ?? 300;
  const tsI = Number(params.ts);
  if (!Number.isFinite(tsI)) {
    throw new ToolsetError("3xx.signature_invalid", { reason: "invalid_timestamp" });
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - tsI) > maxSkew) {
    throw new ToolsetError("3xx.signature_invalid", { reason: "timestamp_skew" });
  }
  const expected = computeSignature({
    secret: params.secret,
    method: params.method,
    path: params.path,
    ts: params.ts,
    nonce: params.nonce,
    body: params.body
  });
  const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(params.provided));
  if (!ok) throw new ToolsetError("3xx.signature_invalid", { reason: "mismatch" });
}
