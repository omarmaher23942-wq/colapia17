import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { isPreviewDeployment, isPreviewSlug, previewKeyMatches } from "@/lib/store-preview";

const KEY = "k".repeat(24);

async function run(url: string, cookies: Record<string, string> = {}) {
  vi.resetModules();
  const { middleware } = await import("@/middleware");
  const req = new NextRequest(url, { headers: { host: new URL(url).host, cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ") } });
  return middleware(req);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("معاينة الفريق: القواعد", () => {
  it("المفتاح يطابق بدقة، والمفتاح القصير أو الغائب لا يطابق شيئاً", () => {
    expect(previewKeyMatches(KEY, KEY)).toBe(true);
    expect(previewKeyMatches(`${KEY}x`, KEY)).toBe(false);
    expect(previewKeyMatches(KEY.slice(1), KEY)).toBe(false);
    expect(previewKeyMatches("", KEY)).toBe(false);
    expect(previewKeyMatches("short", "short")).toBe(false);
    expect(previewKeyMatches(KEY, undefined)).toBe(false);
  });

  it("اسم المتجر بصيغة النطاق الفرعي فقط، والمعاينة في نشرات المعاينة والتطوير فقط", () => {
    expect(isPreviewSlug("atelier")).toBe(true);
    expect(isPreviewSlug("../x")).toBe(false);
    expect(isPreviewSlug("Atelier")).toBe(false);
    expect(isPreviewDeployment({ VERCEL_ENV: "preview" })).toBe(true);
    expect(isPreviewDeployment({ VERCEL_ENV: "production", NODE_ENV: "production" })).toBe(false);
  });
});

describe("معاينة الفريق: middleware", () => {
  it("نشرة المعاينة: ?store= يحفظ المتجر ويعيد التوجيه بلا المعامل، ثم يُعرض المتجر بتجاوز البوابة", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const first = await run("https://colapia-git-x.vercel.app/p/a?store=atelier");
    expect(first.status).toBe(307);
    expect(first.headers.get("location")).toBe("https://colapia-git-x.vercel.app/p/a");
    expect(first.cookies.get("clp_pv_store")?.value).toBe("atelier");

    const next = await run("https://colapia-git-x.vercel.app/p/a", { clp_pv_store: "atelier" });
    expect(next.headers.get("x-middleware-rewrite")).toContain("/s/atelier/p/a");
    expect(next.headers.get("x-middleware-request-x-store-preview")).toBe("1");
  });

  it("الإنتاج يتجاهل ?store= والكوكي تماماً", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");
    const res = await run("https://colapia.vercel.app/?store=atelier", { clp_pv_store: "atelier" });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("مع STORE_PREVIEW_KEY: نشرة المعاينة تتطلب المفتاح", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("STORE_PREVIEW_KEY", KEY);
    expect((await run("https://x.vercel.app/?store=atelier")).status).toBe(404);
    const ok = await run(`https://x.vercel.app/?store=atelier&key=${KEY}`);
    expect(ok.status).toBe(307);
    expect(ok.headers.get("location")).toBe("https://x.vercel.app/");
    expect(ok.cookies.get("clp_pv_key")?.value).toBe(KEY);
  });

  it("نطاق المتجر: ?preview=<المفتاح> يفتح المعاينة، والزائر العادي بلا هيدر المعاينة حتى لو أرسله بنفسه", async () => {
    vi.stubEnv("STORE_PREVIEW_KEY", KEY);
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "colapia.com");
    const set = await run(`https://atelier.colapia.com/?preview=${KEY}`);
    expect(set.status).toBe(307);
    expect(set.cookies.get("clp_pv_key")?.value).toBe(KEY);

    const team = await run("https://atelier.colapia.com/", { clp_pv_key: KEY });
    expect(team.headers.get("x-middleware-request-x-store-preview")).toBe("1");

    vi.resetModules();
    const { middleware } = await import("@/middleware");
    const forged = await middleware(new NextRequest("https://atelier.colapia.com/", { headers: { host: "atelier.colapia.com", "x-store-preview": "1" } }));
    expect(forged.headers.get("x-middleware-rewrite")).toContain("/s/atelier");
    expect(forged.headers.get("x-middleware-request-x-store-preview")).toBeNull();
  });
});
