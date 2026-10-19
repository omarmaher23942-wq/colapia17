import { describe, expect, it } from "vitest";
import { activePrevious, nextPrevious, normalizeSubdomainInput, subdomainRedirectKey, ttlSeconds, validateSubdomain } from "@/lib/subdomain-change";
import { handoffMessage, HANDOFF_KINDS, isHandoffKind } from "@/agent/handoff-messages";
import { parseCloserTurn } from "@/ai/agents/closer/turn";
import { stateBlock } from "@/agent/state";
import { CREATE_ACK } from "@/agent/lead";

describe("تغيير رابط المتجر: الصيغة", () => {
  it("ينظف المدخل ويقبل لصق الرابط كاملاً", () => {
    expect(normalizeSubdomainInput(" My Brand ", "colapia.com")).toBe("my-brand");
    expect(normalizeSubdomainInput("https://nour.colapia.com/p/x", "colapia.com")).toBe("nour");
    expect(normalizeSubdomainInput("nour.eg", "colapia.com")).toBe("nour-eg");
    expect(normalizeSubdomainInput("shop٢٠٢٥", "")).toBe("shop2025");
  });
  it("يرفض الحالي والقصير والمحجوز والرموز", () => {
    expect(validateSubdomain("nour", "nour").ok).toBe(false);
    expect(validateSubdomain("ab", "x").ok).toBe(false);
    expect(validateSubdomain("admin", "x").ok).toBe(false);
    expect(validateSubdomain("demo", "x").ok).toBe(false);
    expect(validateSubdomain("نور", "x").ok).toBe(false);
    expect(validateSubdomain("-nour", "x").ok).toBe(false);
    expect(validateSubdomain("a".repeat(31), "x").ok).toBe(false);
    expect(validateSubdomain("Nour Wear", "x")).toEqual({ ok: true, value: "nour-wear" });
  });
});

describe("تغيير رابط المتجر: التحويل 30 يوماً", () => {
  const now = Date.parse("2026-10-19T10:00:00Z");
  it("القديم يُضاف بمهلة، والرجوع لرابط سابق يحذفه من القائمة، والمنتهي يسقط", () => {
    const first = nextPrevious({}, "old-a", "new-b", now);
    expect(first).toHaveLength(1);
    expect(first[0]!.sub).toBe("old-a");
    expect(new Date(first[0]!.until).getTime() - now).toBe(30 * 86_400_000);
    const back = nextPrevious({ previousSubdomains: first }, "new-b", "old-a", now + 1000);
    expect(back.map((p) => p.sub)).toEqual(["new-b"]);
    const expired = activePrevious({ previousSubdomains: [{ sub: "x", until: new Date(now - 1).toISOString() }] }, now);
    expect(expired).toEqual([]);
    expect(activePrevious({ previousSubdomains: "bad" })).toEqual([]);
  });
  it("مفتاح التحويل ومدته", () => {
    expect(subdomainRedirectKey("Nour")).toBe("sdr:nour");
    expect(ttlSeconds(new Date(now + 3600_000).toISOString(), now)).toBe(3600);
    expect(ttlSeconds(new Date(now - 10).toISOString(), now)).toBe(60);
  });
});

describe("رسائل التسليم الجاهزة", () => {
  const input = { storeName: "نور", setupUrl: "https://colapia.com/setup?t=abc.def", loginUrl: "https://colapia.com/login", storeUrl: "https://nour.colapia.com", email: "nour@gmail.com" };
  it("تحمل الروابط الحقيقية وبريد الدخول ونصيحة البايو", () => {
    const setup = handoffMessage("setup", input);
    expect(setup).toContain(input.setupUrl);
    expect(setup).toContain("nour@gmail.com");
    expect(setup).toContain("Google");
    expect(handoffMessage("login", input)).toContain(input.loginUrl);
    const ready = handoffMessage("ready", input);
    expect(ready).toContain(input.storeUrl);
    expect(ready).toContain("بايو");
  });
  it("بلا بريد تبقى الرسالة صحيحة", () => {
    expect(handoffMessage("setup", { ...input, email: null })).toContain("بالبريد الذي أعطيتمونا");
  });
  it("أنواع الرسائل", () => {
    expect(HANDOFF_KINDS).toEqual(["setup", "login", "ready"]);
    expect(isHandoffKind("ready")).toBe(true);
    expect(isHandoffKind("x")).toBe(false);
  });
});

describe("الوكيل V3", () => {
  it("يقرأ تقدير المحاور ويتسامح مع غيابه أو قيمته الغريبة", () => {
    expect(parseCloserTurn(JSON.stringify({ reply: "أهلاً", speaker: "moderator" }))?.speaker).toBe("moderator");
    expect(parseCloserTurn(JSON.stringify({ reply: "أهلاً" }))?.speaker).toBe("unknown");
    expect(parseCloserTurn(JSON.stringify({ reply: "أهلاً", speaker: 7 }))?.speaker).toBe("unknown");
  });
  it("حالة المحادثة تطلب حضور صاحب القرار حين يكتب مشرف", () => {
    const base = { replies: 2, channel: "instagram" as const, lead: {}, invalid: {}, mentions: { demo: false, golden: false }, storeExists: false, imagesReceived: 0, summary: "", goldenAvailable: true };
    expect(stateBlock({ ...base, speaker: "moderator" })).toContain("صاحب القرار");
    expect(stateBlock({ ...base, speaker: "unknown" })).not.toContain("مشرفاً");
  });
  it("رسالة التأكيد النهائية بوعد التسليم المعتمد", () => {
    expect(CREATE_ACK).toContain("خلال يوم إلى 4 أيام عمل كحد أقصى، وغالباً أسرع");
  });
});
