import { afterEach, describe, expect, it, vi } from "vitest";
import { clientIp, ipBucket } from "@/lib/client-ip";
import { cleanUtm, readJson } from "@/intake/http";
import { filledHoneypot, sameOrigin, submitWaitMs, MIN_FILL_MS } from "@/intake/guard";

afterEach(() => vi.unstubAllEnvs());

const req = (headers: Record<string, string>, body?: string) => new Request("https://colapia.com/api/intake/draft", { method: "POST", headers, body });

describe("عنوان الزائر", () => {
  it("على Vercel لا يُصدَّق cf-connecting-ip (يرسله العميل كما يشاء)", () => {
    const h = new Headers({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "9.9.9.9, 10.0.0.1" });
    expect(clientIp(h)).toBe("9.9.9.9");
  });

  it("خلف Cloudflare فقط بإعداد صريح", () => {
    vi.stubEnv("TRUST_CF_CONNECTING_IP", "1");
    expect(clientIp(new Headers({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "9.9.9.9" }))).toBe("1.1.1.1");
  });

  it("x-real-ip احتياطاً، وبلا أي هيدر عنوان صفري", () => {
    expect(clientIp(new Headers({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(clientIp(new Headers())).toBe("0.0.0.0");
  });

  it("IPv6 يُجمَّع بشبكته /64 حتى لا يُدار الحد بتدوير العناوين", () => {
    expect(ipBucket("2001:db8:abcd:12:1111:2222:3333:4444")).toBe("2001:db8:abcd:12::/64");
    expect(ipBucket("2001:db8:abcd:12::99")).toBe("2001:db8:abcd:12::/64");
    expect(ipBucket("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(ipBucket("41.33.10.2")).toBe("41.33.10.2");
  });
});

describe("حماية API الاستمارة", () => {
  it("نفس المصدر فقط (Origin أو Referer من المنصة)", () => {
    expect(sameOrigin(req({ origin: "https://colapia.com" }))).toBe(true);
    expect(sameOrigin(req({ origin: "https://evil.example" }))).toBe(false);
    expect(sameOrigin(req({ referer: "https://colapia.com/start?d=x" }))).toBe(true);
    expect(sameOrigin(req({ referer: "https://colapia.com.evil.example/" }))).toBe(false);
    expect(sameOrigin(req({}))).toBe(false);
  });

  it("فخ البرامج الآلية: الحقل المخفي فقط يُعامل كبرنامج، والإرسال السريع ينتظر ولا يُرفض", () => {
    expect(filledHoneypot("")).toBe(false);
    expect(filledHoneypot(undefined)).toBe(false);
    expect(filledHoneypot("http://spam")).toBe(true);
    const now = new Date("2026-10-11T10:00:00Z");
    expect(submitWaitMs(new Date(now.getTime() - MIN_FILL_MS - 1), now)).toBe(0);
    expect(submitWaitMs(new Date(now.getTime() - 2000), now)).toBe(MIN_FILL_MS - 2000);
  });

  it("جسم الطلب: حد الحجم وJSON كائن فقط", async () => {
    expect(await readJson(req({ "content-type": "application/json" }, '{"a":1}'))).toEqual({ ok: true, body: { a: 1 } });
    expect(await readJson(req({}, "[1,2]"))).toEqual({ ok: false, status: 400 });
    expect(await readJson(req({}, "not json"))).toEqual({ ok: false, status: 400 });
    expect(await readJson(req({}, JSON.stringify({ x: "a".repeat(100) })), 50)).toEqual({ ok: false, status: 413 });
  });

  it("معاملات الحملة المسموحة فقط، ومعرّفات الإعلانات كعلامة لا قيمة", () => {
    expect(cleanUtm({ utm_source: "instagram", utm_campaign: "x".repeat(200), fbclid: "IwAR123", evil: "<script>" })).toEqual({
      utm_source: "instagram",
      utm_campaign: "x".repeat(100),
      fbclid: "1",
    });
    expect(cleanUtm({})).toBeNull();
    expect(cleanUtm("x")).toBeNull();
  });
});
