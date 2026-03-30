import { describe, expect, it } from "vitest";
import { issueJwt, verifyJwt } from "@toolset/core";

describe("JWT", () => {
  it("issues and verifies", async () => {
    const token = await issueJwt({
      subject: "demo",
      issuer: "toolset",
      audience: "openclaw",
      secret: "secret",
      ttlSeconds: 60
    });
    const p = await verifyJwt({ token, issuer: "toolset", audience: "openclaw", secret: "secret" });
    expect(p.sub).toBe("demo");
    expect(p.kind).toBe("jwt");
  });
});

