import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]);
const HEIC = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0]);
const TEXT = new TextEncoder().encode("<html><script>alert(1)</script></html>");

describe("media types and hosts", () => {
  it("accepts only real image bytes, whatever the browser declares", async () => {
    const { sniffImageType, looksHeic, extensionFor } = await import("@/lib/media");
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("GIF89a\0\0\0\0\0\0"))).toBe("image/gif");
    expect(sniffImageType(TEXT)).toBeNull();
    expect(sniffImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(looksHeic(HEIC)).toBe(true);
    expect(looksHeic(PNG)).toBe(false);
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/svg+xml")).toBeNull();
    expect(extensionFor("audio/webm")).toBeNull();
  });

  it("has no voice route any more and knows its routes", async () => {
    const { isMediaRoute, MEDIA_ROUTES } = await import("@/lib/media");
    expect(isMediaRoute("productImage")).toBe(true);
    expect(isMediaRoute("productImage")).toBe(true);
    expect(isMediaRoute("intakeVoice")).toBe(false);
    expect(isMediaRoute("toString")).toBe(false);
    expect(MEDIA_ROUTES.productImage.maxFiles).toBe(10);
  });

  it("derives the public media host from the root domain unless set explicitly", async () => {
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "colapia.com");
    vi.stubEnv("MEDIA_BASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "");
    const m = await import("@/lib/media");
    expect(m.mediaBaseUrl()).toBe("https://media.colapia.com");
    expect(m.isMediaHost("media.colapia.com")).toBe(true);
    expect(m.isMediaHost("abc.ufs.sh")).toBe(true);
    expect(m.isMediaHost("evil.com")).toBe(false);
    vi.stubEnv("MEDIA_BASE_URL", "https://cdn.example.com/path");
    expect(m.mediaBaseUrl()).toBe("https://cdn.example.com");
    expect(m.isMediaHost("cdn.example.com")).toBe(true);
    vi.stubEnv("MEDIA_BASE_URL", "http://insecure.example.com");
    expect(m.mediaBaseUrl()).toBeNull();
    vi.unstubAllEnvs();
  });

  it("extracts R2 keys safely and trusts only https media hosts", async () => {
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "colapia.com");
    vi.stubEnv("MEDIA_BASE_URL", "");
    const { r2KeyFromUrl } = await import("@/lib/media");
    const { isTrustedUploadUrl } = await import("@/lib/upload-hosts");
    expect(r2KeyFromUrl("https://media.colapia.com/stores/s1/products/abc.jpg")).toBe("stores/s1/products/abc.jpg");
    expect(r2KeyFromUrl("https://media.colapia.com/../x")).toBeNull();
    expect(r2KeyFromUrl("https://utfs.io/f/abc")).toBeNull();
    expect(isTrustedUploadUrl("https://media.colapia.com/stores/x/products/a.jpg")).toBe(true);
    expect(isTrustedUploadUrl("http://media.colapia.com/a.jpg")).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("R2 configuration", () => {
  it("lists exactly which variables are missing", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({ env: { R2_ACCOUNT_ID: "acc12345", R2_BUCKET: "colapia-media" } }));
    const { r2Missing, r2Configured } = await import("@/server/r2");
    expect(r2Missing()).toEqual(["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]);
    expect(r2Configured()).toBe(false);
    vi.doUnmock("@/lib/env");
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({ env: { R2_ACCOUNT_ID: "acc12345", R2_ACCESS_KEY_ID: "AKIATESTKEY0001", R2_SECRET_ACCESS_KEY: "secret-secret-secret-secret", R2_BUCKET: "colapia-media" } }));
    const ok = await import("@/server/r2");
    expect(ok.r2Missing()).toEqual([]);
    expect(ok.r2Configured()).toBe(true);
    expect(ok.publicUrl("stores/s1/a b.jpg")).toBe("https://media.colapia.com/stores/s1/a%20b.jpg");
    vi.doUnmock("@/lib/env");
  });
});

// ─── مسار الرفع عبر الخادم ───────────────────────────────────────────────────

const upload = vi.fn();
const remove = vi.fn();
const authorize = vi.fn();
const after = vi.fn();
const allowFn = vi.fn();

async function post(parts: { route?: string; input?: unknown; files?: { bytes: Uint8Array; type?: string; name?: string }[] }) {
  vi.resetModules();
  vi.doMock("@/server/media-host", () => ({ mediaApi: async () => (hostOn ? { upload, remove } : null) }));
  class UploadPolicyError extends Error {}
  vi.doMock("@/server/upload-policies", () => ({ authorizeUpload: authorize, afterUpload: after, UploadPolicyError }));
  vi.doMock("@/lib/ratelimit", () => ({ allow: allowFn, clientIp: () => "1.2.3.4" }));
  authorize.mockImplementation(async () => {
    if (denied) throw new UploadPolicyError("غير مصرح");
    return { prefix: "requests/r1", meta: { requestId: "r1", kind: "image" } };
  });
  const { POST } = await import("@/app/api/upload/route");
  const fd = new FormData();
  if (parts.route !== undefined) fd.set("route", parts.route);
  if (parts.input !== undefined) fd.set("input", JSON.stringify(parts.input));
  for (const f of parts.files ?? []) fd.append("file", new File([f.bytes as BlobPart], f.name ?? "x.png", { type: f.type ?? "image/png" }));
  const res = await POST(new Request("https://colapia.com/api/upload", { method: "POST", body: fd }));
  return { status: res.status, body: (await res.json()) as { error?: string; files?: { key: string; url: string; type: string; size: number }[] } };
}

let hostOn = true;
let denied = false;
beforeEach(() => {
  hostOn = true;
  denied = false;
  upload.mockReset().mockImplementation(async (f: { prefix: string; ext: string }) => ({ key: `${f.prefix}/abc.${f.ext}`, url: `https://media.colapia.com/${f.prefix}/abc.${f.ext}` }));
  remove.mockReset().mockResolvedValue(true);
  after.mockReset().mockResolvedValue(undefined);
  allowFn.mockReset().mockResolvedValue(true);
});

describe("POST /api/upload (server-mediated)", () => {
  it("stores the image with its real type even if the browser declares something else", async () => {
    const r = await post({ route: "productImage", input: { token: "t", kind: "image" }, files: [{ bytes: PNG, type: "application/octet-stream", name: "IMG_0001" }] });
    expect(r.status).toBe(200);
    expect(r.body.files?.[0]).toMatchObject({ key: "requests/r1/abc.png", url: "https://media.colapia.com/requests/r1/abc.png", type: "image/png" });
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ type: "image/png", ext: "png", prefix: "requests/r1" }));
    expect(after).toHaveBeenCalledWith("productImage", { requestId: "r1", kind: "image" }, expect.objectContaining({ key: "requests/r1/abc.png", type: "image/png" }));
  });

  it("rejects non-images, HEIC, empty files, unknown routes and missing files without storing anything", async () => {
    expect((await post({ route: "productImage", files: [{ bytes: TEXT }] })).status).toBe(400);
    const heic = await post({ route: "productImage", files: [{ bytes: HEIC, type: "image/heic" }] });
    expect(heic.status).toBe(400);
    expect(heic.body.error).toMatch(/HEIC/);
    expect((await post({ route: "productImage", files: [{ bytes: new Uint8Array([1, 2]) }] })).status).toBe(400);
    expect((await post({ route: "nope", files: [{ bytes: PNG }] })).status).toBe(400);
    expect((await post({ route: "intakeVoice", files: [{ bytes: PNG }] })).status).toBe(400);
    expect((await post({ route: "productImage", files: [] })).status).toBe(400);
    expect((await post({ files: [{ bytes: PNG }] })).status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it("limits file count and size per route", async () => {
    expect((await post({ route: "brandAsset", files: [{ bytes: PNG }, { bytes: PNG }] })).status).toBe(400);
    const big = new Uint8Array(5 << 20);
    big.set(PNG);
    expect((await post({ route: "brandAsset", files: [{ bytes: big }] })).status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it("applies the policy and the rate limit before touching storage", async () => {
    denied = true;
    expect((await post({ route: "productImage", files: [{ bytes: PNG }] })).status).toBe(403);
    denied = false;
    allowFn.mockResolvedValue(false);
    expect((await post({ route: "productImage", files: [{ bytes: PNG }] })).status).toBe(429);
    expect(upload).not.toHaveBeenCalled();
  });

  it("answers 503 when no storage is configured and cleans up when registering fails", async () => {
    hostOn = false;
    expect((await post({ route: "productImage", files: [{ bytes: JPEG }] })).status).toBe(503);
    hostOn = true;
    after.mockRejectedValue(new Error("db down"));
    const r = await post({ route: "productImage", files: [{ bytes: JPEG }] });
    expect(r.status).toBe(500);
    expect(remove).toHaveBeenCalledWith(["requests/r1/abc.jpg"]);
  });
});

// ─── خدمة media.* من R2 داخل العامل ──────────────────────────────────────────

describe("Cloudflare worker media serving", () => {
  const env = { ROOT_DOMAIN: "colapia.com", R2_ACCOUNT_ID: "acc", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "b" };
  const ctx = { waitUntil: () => {} };
  const png = () => new Response(PNG, { headers: { "content-type": "image/png", etag: '"e1"', "content-length": String(PNG.length) } });

  it("derives the host and parses keys strictly", async () => {
    const { mediaHostname, mediaKey } = await import("../../cloudflare/media");
    expect(mediaHostname(env)).toBe("media.colapia.com");
    expect(mediaHostname({ ...env, MEDIA_BASE_URL: "https://cdn.example.com" })).toBe("cdn.example.com");
    expect(mediaHostname({ ROOT_DOMAIN: "localhost" })).toBeNull();
    expect(mediaKey("/stores/s1/products/9f1c2e7a-0b3d-4c11-8a55-1e2f3a4b5c6d.jpg")).toBe("stores/s1/products/9f1c2e7a-0b3d-4c11-8a55-1e2f3a4b5c6d.jpg");
    expect(mediaKey("/stores/s1/products/a%20b.jpg")).toBeNull();
    expect(mediaKey("/../etc/passwd")).toBeNull();
    expect(mediaKey("/a//b.png")).toBeNull();
    expect(mediaKey("/")).toBeNull();
    expect(mediaKey("/%E0%A4%A")).toBeNull();
  });

  it("serves images from the object store with long cache, and ignores other hosts", async () => {
    const { serveMedia } = await import("../../cloudflare/media");
    const fetcher = vi.fn(async () => png());
    expect(await serveMedia(new Request("https://shop.colapia.com/x.png"), env, ctx, fetcher)).toBeNull();
    const r = (await serveMedia(new Request("https://media.colapia.com/stores/s1/products/a.png"), env, ctx, fetcher))!;
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/png");
    expect(r.headers.get("cache-control")).toContain("immutable");
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
    expect(fetcher).toHaveBeenCalledWith("stores/s1/products/a.png");
  });

  it("never serves active content inline, handles misses, methods and missing configuration", async () => {
    const { serveMedia } = await import("../../cloudflare/media");
    const html = vi.fn(async () => new Response("<script>1</script>", { headers: { "content-type": "text/html" } }));
    const h = (await serveMedia(new Request("https://media.colapia.com/stores/s1/x.png"), env, ctx, html))!;
    expect(h.headers.get("content-type")).toBe("application/octet-stream");
    expect(h.headers.get("content-disposition")).toBe("attachment");
    const miss = vi.fn(async () => new Response("", { status: 404 }));
    expect((await serveMedia(new Request("https://media.colapia.com/stores/s1/none.png"), env, ctx, miss))!.status).toBe(404);
    expect((await serveMedia(new Request("https://media.colapia.com/stores/s1/x.png", { method: "POST" }), env, ctx, miss))!.status).toBe(405);
    expect((await serveMedia(new Request("https://media.colapia.com/../x"), env, ctx, miss))!.status).toBe(404);
    expect((await serveMedia(new Request("https://media.colapia.com/stores/s1/x.png"), { ROOT_DOMAIN: "colapia.com" }, ctx))!.status).toBe(503);
  });
});
