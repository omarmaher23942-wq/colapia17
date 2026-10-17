// الانتقال إلى Cloudflare (14-ب.7): سجلات النطاق الخاص لـ Cloudflare for SaaS،
// وروابط *.workers.dev في الوسيط.
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { dnsPointsToUs, dnsRecordsFor, explainDns, normalizeDomain, type DomainTarget } from "@/lib/custom-domain";

vi.mock("server-only", () => ({}));

const CF: DomainTarget = { kind: "cloudflare", cname: "customers.colapia.com" };

describe("النطاق الخاص على Cloudflare for SaaS", () => {
  it("كل السجلات CNAME إلى نطاق الاستقبال", () => {
    expect(dnsRecordsFor("mystore.com", CF)).toEqual([
      { type: "CNAME", name: "@", value: "customers.colapia.com" },
      { type: "CNAME", name: "www", value: "customers.colapia.com" },
    ]);
    expect(dnsRecordsFor("shop.mystore.com.eg", CF)).toEqual([{ type: "CNAME", name: "shop", value: "customers.colapia.com" }]);
  });
  it("الإشارة إلينا = CNAME إلى نطاق الاستقبال فقط (لا عنوان Vercel)", () => {
    expect(dnsPointsToUs({ a: [], cname: ["Customers.Colapia.com."] }, CF)).toBe(true);
    expect(dnsPointsToUs({ a: ["76.76.21.21"], cname: [] }, CF)).toBe(false);
    expect(explainDns("x.com", { a: [], cname: ["customers.colapia.com"] }, CF)).toContain("يشير لمتجرك");
  });
  it("يرفض نطاقات المزودين", () => {
    for (const bad of ["colapia.acct.workers.dev", "x.pages.dev", "pub-1.r2.dev"]) expect(normalizeDomain(bad)).toBeNull();
  });
});

describe("الوسيط على *.workers.dev", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  async function run(url: string, key?: string) {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "colapia.com");
    vi.stubEnv("NODE_ENV", "production");
    if (key) vi.stubEnv("STORE_PREVIEW_KEY", key);
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ result: null })));
    const { middleware } = await import("@/middleware");
    return middleware(new NextRequest(url, { headers: { host: new URL(url).host } }));
  }
  it("رابط workers.dev يُعامل كالمنصة لا كنطاق متجر مجهول", async () => {
    const r = await run("https://colapia.acct.workers.dev/");
    expect(r.status).not.toBe(404);
  });
  it("?store= على workers.dev بلا مفتاح معاينة لا يفتح متجراً", async () => {
    const r = await run("https://colapia.acct.workers.dev/?store=nova");
    expect(r.headers.get("set-cookie") ?? "").not.toContain("clp_pv_store");
  });
  it("?store= مع المفتاح الصحيح يفتح المعاينة", async () => {
    const key = "k".repeat(24);
    const r = await run(`https://colapia.acct.workers.dev/?store=nova&key=${key}`, key);
    expect(r.headers.get("set-cookie") ?? "").toContain("clp_pv_store=nova");
  });
});
