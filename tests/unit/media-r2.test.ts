import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    AUTH_SECRET: "test-secret-test-secret-test-secret-00",
    R2_ACCOUNT_ID: "acc12345",
    R2_ACCESS_KEY_ID: "AKIATESTKEY0001",
    R2_SECRET_ACCESS_KEY: "secret-secret-secret-secret",
    R2_BUCKET: "colapia-media",
  },
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL = "https://media.colapia.com";
});

describe("media routes and hosts", () => {
  it("accepts only known image/audio types per route", async () => {
    const { extensionFor, isMediaRoute } = await import("@/lib/media");
    expect(extensionFor("productImage", "image/jpeg")).toBe("jpg");
    expect(extensionFor("productImage", "image/svg+xml")).toBeNull();
    expect(extensionFor("intakeVoice", "audio/webm;codecs=opus")).toBe("webm");
    expect(extensionFor("intakeVoice", "image/png")).toBeNull();
    expect(isMediaRoute("productImage")).toBe(true);
    expect(isMediaRoute("toString")).toBe(false);
  });
  it("recognises our R2 host and legacy UploadThing, and extracts R2 keys safely", async () => {
    const { isMediaHost, r2KeyFromUrl } = await import("@/lib/media");
    const { isTrustedUploadUrl } = await import("@/lib/upload-hosts");
    expect(isMediaHost("media.colapia.com")).toBe(true);
    expect(isMediaHost("abc.ufs.sh")).toBe(true);
    expect(isMediaHost("evil.com")).toBe(false);
    expect(isTrustedUploadUrl("https://media.colapia.com/stores/x/products/a.jpg")).toBe(true);
    expect(isTrustedUploadUrl("http://media.colapia.com/a.jpg")).toBe(false);
    expect(r2KeyFromUrl("https://media.colapia.com/stores/s1/products/abc.jpg")).toBe("stores/s1/products/abc.jpg");
    expect(r2KeyFromUrl("https://media.colapia.com/../x")).toBeNull();
    expect(r2KeyFromUrl("https://utfs.io/f/abc")).toBeNull();
  });
});

describe("upload ticket and R2 presign", () => {
  it("tickets round-trip and reject tampering", async () => {
    const { issueTicket, readTicket } = await import("@/server/upload-ticket");
    const t = issueTicket({ r: "intakeImage", k: "requests/r1/a.jpg", t: "image/jpeg", s: 1234, m: { requestId: "r1", kind: "image" } });
    expect(readTicket(t)?.m.requestId).toBe("r1");
    const [body, mac] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body!, "base64url").toString()), m: { requestId: "other" } })).toString("base64url");
    expect(readTicket(`${forged}.${mac}`)).toBeNull();
    expect(readTicket("garbage")).toBeNull();
  });
  it("presigned PUT signs the type and exact size for 10 minutes", async () => {
    const { presignPut, publicUrl, r2Configured } = await import("@/server/r2");
    expect(r2Configured()).toBe(true);
    const p = await presignPut("stores/s1/products/a b.jpg", "image/jpeg", 2048);
    const u = new URL(p.url);
    expect(u.host).toBe("acc12345.r2.cloudflarestorage.com");
    expect(u.pathname).toBe("/colapia-media/stores/s1/products/a%20b.jpg");
    expect(u.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(u.searchParams.get("X-Amz-SignedHeaders")).toContain("content-length");
    expect(u.searchParams.get("X-Amz-SignedHeaders")).toContain("content-type");
    expect(u.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(p.headers).toEqual({ "content-type": "image/jpeg" });
    expect(publicUrl("stores/s1/a b.jpg")).toBe("https://media.colapia.com/stores/s1/a%20b.jpg");
  });
});
