import { SignJWT, jwtVerify } from "jose";
import { ToolsetError } from "./errors";

export type Principal = {
  sub: string;
  kind: "jwt" | "api_key";
  scopes: string[];
  api_key_id?: string;
};

function textSecret(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function issueJwt(params: {
  subject: string;
  issuer: string;
  audience: string;
  secret: string;
  ttlSeconds: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ scope: "tools:invoke tools:read" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(params.issuer)
    .setAudience(params.audience)
    .setSubject(params.subject)
    .setIssuedAt(now)
    .setExpirationTime(now + params.ttlSeconds)
    .sign(textSecret(params.secret));
}

export async function verifyJwt(params: {
  token: string;
  issuer: string;
  audience: string;
  secret: string;
}): Promise<Principal> {
  try {
    const { payload } = await jwtVerify(params.token, textSecret(params.secret), {
      issuer: params.issuer,
      audience: params.audience
    });
    const scope = String(payload.scope ?? "");
    const scopes = scope.split(/\s+/).filter(Boolean);
    const sub = String(payload.sub ?? "");
    if (!sub) throw new Error("missing sub");
    return { sub, kind: "jwt", scopes };
  } catch {
    throw new ToolsetError("3xx.unauthorized", { reason: "invalid_token" });
  }
}
