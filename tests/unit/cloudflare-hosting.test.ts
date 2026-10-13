// الانتقال إلى Cloudflare (14-ب.7): قارئ أرشيف المستودع لتسليم الكود، وسجلات النطاق الخاص لـ Cloudflare for SaaS،
// وروابط *.workers.dev في الوسيط.
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { untar, memorySource } from "@/server/ownership/source";
import { dnsPointsToUs, dnsRecordsFor, explainDns, normalizeDomain, type DomainTarget } from "@/lib/custom-domain";

vi.mock("server-only", () => ({}));

const enc = new TextEncoder();
function header(name: string, size: number, type: string): Uint8Array {
  const h = new Uint8Array(512);
  h.set(enc.encode(name.slice(0, 100)), 0);
  h.set(enc.encode(size.toString(8).padStart(11, "0") + "\0"), 124);
  h[156] = type.charCodeAt(0);
  h.set(enc.encode("ustar\0"), 257);
  return h;
}
const pad = (b: Uint8Array) => {
  const out = new Uint8Array(Math.ceil(b.length / 512) * 512);
  out.set(b);
  return out;
};
function tar(entries: { name: string; body: string; type?: string }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const e of entries) {
    const body = enc.encode(e.body);
    parts.push(header(e.name, body.length, e.type ?? "0"), pad(body));
  }
  parts.push(new Uint8Array(1024));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) (out.set(p, o), (o += p.length));
  return out;
}

describe("أرشيف المستودع (تسليم الكود على Cloudflare)", () => {
  it("يفك الملفات ويحذف المجلد الأول ويحترم الأسماء الطويلة (pax)", () => {
    const long = `repo-sha/src/${"a".repeat(120)}.ts`;
    const pax = `${long.length + 7 + String(long.length + 7).length} path=${long}\n`;
    const files = untar(
      tar([
        { name: "pax_global_header", body: "52 comment=abc\n", type: "g" },
        { name: "repo-sha/", body: "", type: "5" },
        { name: "repo-sha/package.json", body: '{"name":"x"}' },
        { name: "PaxHeader", body: pax, type: "x" },
        { name: "repo-sha/src/trunc", body: "export {}" },
        { name: "repo-sha/docs/a.md", body: "doc" },
      ]),
      (p) => !p.startsWith("docs/")
    );
    expect([...files.keys()].sort()).toEqual(["package.json", `src/${"a".repeat(120)}.ts`]);
    const src = memorySource(files);
    expect(src.isFile("package.json")).toBe(true);
    expect(src.isFile("docs/a.md")).toBe(false);
  });
});

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
