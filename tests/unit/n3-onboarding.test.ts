import { describe, expect, it, vi } from "vitest";
import { checkLinkToken, issueLinkToken, peekLinkId } from "@/lib/link-token";
import { passwordIssues, passwordStrength } from "@/lib/password-rules";
import { createLockout, MAX_FAILS, type CounterStore } from "@/lib/login-lockout";
import { buildRecipe, neighbour, readAnswers, setupRecipeOverrideSchema, visibleSteps, type StoreFacts } from "@/lib/setup-recipe";
import { sealSecret, openSecret } from "@/lib/secret-box";
import { checkSecret, viewFrom } from "@/lib/connections";
import { isLinkPreviewBot } from "@/lib/link-preview-bot";

const SECRET = "test-secret-0123456789";
const ID = "123e4567-e89b-12d3-a456-426614174000";

describe("رمز الرابط الموقّع", () => {
  const now = 1_700_000_000_000;
  it("يصح قبل 14 يوماً ويسقط بعدها", () => {
    const t = issueLinkToken(SECRET, "setup", ID, { now });
    expect(peekLinkId(t)).toBe(ID);
    expect(checkLinkToken(SECRET, "setup", t, { now: now + 13 * 86_400_000 })).toMatchObject({ ok: true, id: ID });
    expect(checkLinkToken(SECRET, "setup", t, { now: now + 15 * 86_400_000 })).toEqual({ ok: false, reason: "expired" });
  });
  it("يرفض سراً أو غرضاً أو توقيعاً مختلفاً", () => {
    const t = issueLinkToken(SECRET, "setup", ID, { now });
    expect(checkLinkToken("other", "setup", t, { now }).ok).toBe(false);
    expect(checkLinkToken(SECRET, "reset", t, { now }).ok).toBe(false);
    expect(checkLinkToken(SECRET, "setup", t.slice(0, -1) + "x", { now }).ok).toBe(false);
    expect(checkLinkToken(SECRET, "setup", "junk", { now }).ok).toBe(false);
  });
  it("رابط إعادة التعيين يبطل بتغيّر البصمة (لمرة واحدة)", () => {
    const t = issueLinkToken(SECRET, "reset", ID, { now, fp: "aaa" });
    expect(checkLinkToken(SECRET, "reset", t, { now, fp: "aaa" }).ok).toBe(true);
    expect(checkLinkToken(SECRET, "reset", t, { now, fp: "bbb" }).ok).toBe(false);
    expect(checkLinkToken(SECRET, "reset", t, { now: now + 3 * 86_400_000, fp: "aaa" })).toEqual({ ok: false, reason: "expired" });
  });
});

describe("كلمة المرور", () => {
  it("قواعد بالعربية", () => {
    expect(passwordIssues("abc1")).not.toHaveLength(0);
    expect(passwordIssues("onlyletterslong")).toContain("تحتوي حرفاً ورقماً على الأقل.");
    expect(passwordIssues("Password12345")).not.toHaveLength(0);
    expect(passwordIssues("nourstore2026!", { email: "nourstore@x.com" })).not.toHaveLength(0);
    expect(passwordIssues("blue-Horse-4815")).toEqual([]);
  });
  it("المقياس يتدرج", () => {
    expect(passwordStrength("").score).toBe(0);
    expect(passwordStrength("abc").score).toBeLessThanOrEqual(1);
    expect(passwordStrength("blue-Horse-4815!x").score).toBeGreaterThanOrEqual(3);
  });
});

describe("قفل الدخول", () => {
  const mem = () => {
    const m = new Map<string, number>();
    const s: CounterStore = { incr: async (k) => { m.set(k, (m.get(k) ?? 0) + 1); return m.get(k)!; }, expire: async () => {}, get: async (k) => m.get(k) ?? null, del: async (k) => { m.delete(k); } };
    return s;
  };
  it("يقفل بعد الحد ويصفّر بالنجاح", async () => {
    const l = createLockout(mem(), "t");
    for (let i = 1; i < MAX_FAILS; i++) expect((await l.fail("a")).locked).toBe(false);
    expect(await l.isLocked("a")).toBe(false);
    expect((await l.fail("a")).locked).toBe(true);
    expect(await l.isLocked("a")).toBe(true);
    expect(await l.isLocked("b")).toBe(false);
    await l.clear("a");
    expect(await l.isLocked("a")).toBe(false);
  });
});

const facts = (o: Partial<StoreFacts> = {}): StoreFacts => ({
  storeName: "نور", hasLogo: true, products: { total: 0, active: 0, drafts: 0 }, lookReady: false, cod: false, transferReady: false, transferIncomplete: false, inspectionAnswered: false, whatsapp: false, zonesSaved: false, ...o,
});

describe("وصفة الإعداد", () => {
  it("متجر خام: يسأل عن كل شيء، والمنتجات رفع جماعي", () => {
    const r = buildRecipe({ answers: null, facts: facts() });
    expect(r.productsMode).toBe("bulk_upload");
    expect(r.commerceAsk).toEqual(expect.arrayContaining(["cod", "whatsapp", "shipping"]));
    expect(r.steps.find((s) => s.id === "look")!.mode).toBe("ask");
  });
  it("متجر مجهز: كله بتأكيد، دون أسئلة ولا هدية ولا إلغاء، وفي أقل من دقيقتين", () => {
    const r = buildRecipe({ answers: null, facts: facts({ products: { total: 8, active: 8, drafts: 0 }, lookReady: true, cod: true, transferReady: true, inspectionAnswered: true, whatsapp: true, zonesSaved: true }) });
    expect(r.commerceAsk).toEqual([]);
    expect(r.steps.map((s) => s.mode)).toEqual(["prefilled", "prefilled", "skip", "prefilled", "ask"]);
    expect(r.estimatedSeconds).toBeLessThan(120);
    expect(visibleSteps(r)).toEqual(["identity", "products", "commerce", "publish"]);
    expect(neighbour(r, "products", 1)).toBe("commerce");
    expect(r.commerceAsk.join()).not.toMatch(/gift|cancel|discount/);
  });
  it("منتجات الفريق بلا أسعار: تكمل الناقص فقط", () => {
    const r = buildRecipe({ answers: null, facts: facts({ products: { total: 5, active: 2, drafts: 3 } }) });
    expect(r.productsMode).toBe("fill_missing");
    expect(r.steps.find((s) => s.id === "products")!.mode).toBe("ask");
  });
  it("المعاينة تُسأل إن لم تُجَب، وتحويل غير مكتمل يُسأل", () => {
    expect(buildRecipe({ answers: null, facts: facts({ cod: true, whatsapp: true, zonesSaved: true }) }).commerceAsk).toEqual(["inspection"]);
    expect(buildRecipe({ answers: null, facts: facts({ cod: true, transferIncomplete: true, inspectionAnswered: true, whatsapp: true, zonesSaved: true }) }).commerceAsk).toEqual(["transfer"]);
  });
  it("التجاوز والإجابات", () => {
    const ov = setupRecipeOverrideSchema.parse({ steps: { identity: "skip" }, commerce: { skip: ["whatsapp"] } });
    const r = buildRecipe({ answers: null, facts: facts(), override: ov });
    expect(r.steps[0]!.mode).toBe("skip");
    expect(r.commerceAsk).not.toContain("whatsapp");
    expect(setupRecipeOverrideSchema.safeParse({ extra: 1 }).success).toBe(false);
    expect(readAnswers({ v: 5, identity: { storeName: "نور" }, products: { text: "صور على الموبايل" } })?.productsText).toBe("صور على الموبايل");
    expect(readAnswers({ v: 4 })).toBeNull();
  });
});

describe("صندوق الأسرار والربط", () => {
  it("تشفير ذهاباً وإياباً ولا يفتحه سر آخر", () => {
    const s = sealSecret(SECRET, "postgresql://u:p@h/db");
    expect(s).not.toContain("postgresql");
    expect(openSecret(SECRET, s)).toBe("postgresql://u:p@h/db");
    expect(openSecret("x", s)).toBeNull();
    expect(openSecret(SECRET, "plain")).toBeNull();
  });
  it("فحص الحقول", () => {
    expect(checkSecret("neonUrl", "postgresql://u:p@ep-x.neon.tech/db?sslmode=require").ok).toBe(true);
    expect(checkSecret("neonUrl", "http://x").ok).toBe(false);
    expect(checkSecret("groqKey", "gsk_" + "a".repeat(30)).ok).toBe(true);
    expect(checkSecret("groqKey", "AIza123").ok).toBe(false);
    expect(checkSecret("imagekitEndpoint", "https://ik.imagekit.io/abc").ok).toBe(true);
  });
  it("العرض لا يحمل قيماً سرية", () => {
    const v = viewFrom({ connections: { secrets: { groqKey: "enc:v1:xx" }, team: { github: { username: "u", status: "ready" } } } });
    expect(v.saved.groqKey).toBe(true);
    expect(v.saved.neonUrl).toBe(false);
    expect(JSON.stringify(v)).not.toContain("enc:v1");
  });
});

describe("زواحف المعاينة لا تبدأ العدّاد", () => {
  it("يميّز الزاحف من المتصفح", () => {
    expect(isLinkPreviewBot("facebookexternalhit/1.1")).toBe(true);
    expect(isLinkPreviewBot("WhatsApp/2.23")).toBe(true);
    expect(isLinkPreviewBot(null)).toBe(true);
    expect(isLinkPreviewBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Safari/604.1")).toBe(false);
  });
});

describe("بدء عدّاد المعاينة ذرياً", () => {
  it("فاتحان معاً: واحد يبدأ ويجدول والآخر لا أثر له", async () => {
    vi.resetModules();
    let claimed = false;
    const scheduleTrial = vi.fn(async () => {});
    const schedulePaymentInvite = vi.fn(async () => {});
    vi.doMock("@/db/client", () => ({
      db: {
        update: () => ({ set: () => ({ where: () => ({ returning: async () => { if (claimed) return []; claimed = true; return [{ id: "s1", priceLockedEgp: 1 }]; } }) }) }),
        select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ ends: new Date("2030-01-01") }] }) }) }),
      },
    }));
    vi.doMock("@/lifecycle/scheduler", () => ({ cancelJobs: async () => {}, JOB_KINDS: ["setup.a", "trial.freeze"], scheduleTrial, schedulePaymentInvite }));
    vi.doMock("@/lifecycle/timings", () => ({ lifecycleTimings: async () => ({ trialHours: 24, noticeHours: 24, deleteHours: 24, graceDays: 14 }) }));
    vi.doMock("@/server/pricing", () => ({ currentPricing: async () => ({ regularPrice: 4999 }) }));
    vi.doMock("@/lib/tenant", () => ({ invalidateStoreCache: async () => {} }));
    const { beginPreviewClock } = await import("@/server/preview-clock");
    const [a, b] = await Promise.all([beginPreviewClock("s1"), beginPreviewClock("s1")]);
    expect([a.started, b.started].sort()).toEqual([false, true]);
    expect(scheduleTrial).toHaveBeenCalledTimes(1);
    expect(schedulePaymentInvite).toHaveBeenCalledTimes(1);
    expect((a.started ? a : b).endsAt!.getTime() - Date.now()).toBeGreaterThan(23 * 3600_000);
  });
});
