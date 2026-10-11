import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { dnsPointsToUs, dnsRecordsFor, isApex, normalizeDomain, VERCEL_A, VERCEL_CNAME } from "@/lib/custom-domain";

describe("النطاق الخاص: التطبيع", () => {
  it("ينظف ما يكتبه التاجر", () => {
    expect(normalizeDomain("https://WWW.MyStore.com/path?x=1")).toBe("mystore.com");
    expect(normalizeDomain("shop.mystore.com")).toBe("shop.mystore.com");
    expect(normalizeDomain("mystore.com.eg.")).toBe("mystore.com.eg");
  });
  it("يرفض نطاقاتنا والصيغ الخاطئة", () => {
    for (const bad of ["colapia.com", "shop.colapia.com", "x.vercel.app", "localhost", "a", "my store.com", "-x.com", "user@x.com", "x.com:8080", "1.2.3.4"]) expect(normalizeDomain(bad)).toBeNull();
  });
  it("الجذري: A + www، والفرعي: CNAME", () => {
    expect(isApex("mystore.com")).toBe(true);
    expect(isApex("mystore.com.eg")).toBe(true);
    expect(isApex("shop.mystore.com")).toBe(false);
    expect(dnsRecordsFor("mystore.com")).toEqual([{ type: "A", name: "@", value: VERCEL_A }, { type: "CNAME", name: "www", value: VERCEL_CNAME }]);
    expect(dnsRecordsFor("shop.mystore.com")).toEqual([{ type: "CNAME", name: "shop", value: VERCEL_CNAME }]);
  });
  it("يكتشف الإشارة إلينا", () => {
    expect(dnsPointsToUs({ a: [VERCEL_A], cname: [] })).toBe(true);
    expect(dnsPointsToUs({ a: [], cname: ["cname.vercel-dns.com."] })).toBe(true);
    expect(dnsPointsToUs({ a: ["1.1.1.1"], cname: [] })).toBe(false);
  });
});

describe("الوسيط: النطاق الخاص", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  async function run(url: string, map: Record<string, string>) {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "colapia.com");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    vi.stubGlobal("fetch", async (u: string) => {
      const key = decodeURIComponent(String(u).split("/get/")[1] ?? "");
      return new Response(JSON.stringify({ result: map[key] ?? null }));
    });
    const { middleware } = await import("@/middleware");
    return middleware(new NextRequest(url, { headers: { host: new URL(url).host } }));
  }
  it("نطاق مربوط يخدم متجره", async () => {
    const r = await run("https://mystore.com/p/shirt", { "cd:mystore.com": "nova" });
    expect(r.headers.get("x-middleware-rewrite")).toContain("/s/nova/p/shirt");
  });
  it("نطاق غير معروف = 404 (لا تُعرض المنصة على نطاق غريب)", async () => {
    const r = await run("https://random.com/", {});
    expect(r.status).toBe(404);
  });
  it("النطاق الفرعي لمتجر له نطاق مفعّل يحوّل إليه", async () => {
    const r = await run("https://nova.colapia.com/p/shirt?x=1", { "cdr:nova": "mystore.com" });
    expect(r.status).toBe(308);
    expect(r.headers.get("location")).toBe("https://mystore.com/p/shirt?x=1");
  });
});
