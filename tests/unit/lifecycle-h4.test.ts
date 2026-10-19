import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { extendHosting, hostingState, canRenewNow, addMonths } from "@/lib/hosting";
import { dashboardLock, lockAllowsPath, storeVisibility } from "@/lib/store-visibility";

const DAY = 86_400_000;
const now = new Date("2026-10-19T10:00:00Z");

describe("دورة الحياة: الدفع بعد التجميد وقبله", () => {
  it("دفع متجر مجمّد يفتح اللوحة فوراً ويعيد الظهور (الحالة تصير active)", () => {
    const frozen = { status: "frozen" };
    expect(dashboardLock(frozen, { phase: "none" })).toBe("frozen");
    const paid = { status: "active", activatedAt: now, hostingExpiresAt: extendHosting(null, 3, now), planMonths: 3 };
    const h = hostingState(paid, now);
    expect(dashboardLock({ status: "active" }, h)).toBeNull();
    expect(storeVisibility({ status: "active" }, h).public).toBe(true);
  });
  it("متجر متوقف بعد الانتهاء يُقفل، والتجديد يمد من اليوم لا من تاريخ قديم (لا يدفع عن أيام التوقف)", () => {
    const expired = new Date(now.getTime() - 40 * DAY);
    const st = hostingState({ status: "active", activatedAt: expired, hostingExpiresAt: expired }, now);
    expect(st.phase).toBe("paused");
    expect(dashboardLock({ status: "active" }, st)).toBe("paused");
    expect(canRenewNow(st)).toBe(true);
    expect(extendHosting(expired, 1, now).getTime()).toBe(addMonths(now, 1).getTime());
  });
  it("التجديد المبكر يمد من نهاية الاشتراك الحالي بلا خسارة أيام", () => {
    const end = new Date(now.getTime() + 20 * DAY);
    expect(extendHosting(end, 3, now).getTime()).toBe(addMonths(end, 3).getTime());
  });
  it("لا تجديد قبل فتح نافذته (أكثر من 60 يوماً)", () => {
    const st = hostingState({ status: "active", activatedAt: now, hostingExpiresAt: new Date(now.getTime() + 200 * DAY) }, now);
    expect(canRenewNow(st)).toBe(false);
  });
  it("مهلة السماح: يعمل المتجر ولا تُقفل اللوحة، ثم يتوقف دون حذف", () => {
    const e = new Date(now.getTime() - 1 * DAY);
    const grace = hostingState({ status: "active", activatedAt: e, hostingExpiresAt: e }, now);
    expect(grace.phase).toBe("grace");
    expect(dashboardLock({ status: "active" }, grace)).toBeNull();
    expect(storeVisibility({ status: "active" }, { phase: "paused" }).public).toBe(false);
  });
  it("القفل لا يُتجاوز بتحايل على المسار: الاشتراك والاستخدام فقط", () => {
    expect(lockAllowsPath("/dashboard/billing")).toBe(true);
    expect(lockAllowsPath("/dashboard/billing?locked=1")).toBe(true);
    expect(lockAllowsPath("/dashboard/billingx")).toBe(false);
    expect(lockAllowsPath("/dashboard/orders")).toBe(false);
    expect(lockAllowsPath("/dashboard/orders?x=/dashboard/billing")).toBe(false);
  });
});

describe("المتجر المدفوع لا يُحذف أبداً", () => {
  const src = readFileSync("src/lifecycle/handlers.ts", "utf8");
  it("كل انتقال إلى deleted في المؤقتات ينطلق من حالات غير مدفوعة فقط", () => {
    const blocks = [...src.matchAll(/to:\s*"deleted"[\s\S]{0,200}?from:\s*\[([^\]]*)\]|from:\s*\[([^\]]*)\][\s\S]{0,200}?to:\s*"deleted"/g)];
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) expect(b[1] ?? b[2]).not.toMatch(/active/);
  });
});

describe("سلامة نقاط الدخول العامة (فحص مصدر)", () => {
  it("إجراء الدفع لصاحب المتجر وحده، والإيصال الواحد قيد المراجعة للمتجر مفروض بفهرس فريد", () => {
    const pay = readFileSync("src/server/actions/platform.ts", "utf8");
    expect(pay).toMatch(/ownerStore\(\{ allowLocked: true \}\)/);
    expect(pay).toMatch(/isTrustedUploadUrl\(input\.screenshotUrl\)/);
    const schema = readFileSync("src/db/schema/commerce.ts", "utf8");
    expect(schema).toMatch(/platform_payments_store_under_review_uq/);
  });
  it("حد استعمال كود الخصم ذري في القاعدة (قيد CHECK) فلا يتجاوزه طلبان متزامنان", () => {
    expect(readFileSync("src/db/schema/commerce.ts", "utf8")).toMatch(/used_count\} <= \$\{t\.maxUses\}|usedCount\} <= \$\{t\.maxUses\}/);
  });
  it("الوكيل لا يعالج رسالة بلا حراسة المخرج", () => {
    const rt = readFileSync("src/ai/agents/closer/runtime.ts", "utf8");
    expect(rt).toMatch(/replyProblem\(turn\.reply/);
    expect(rt).toMatch(/isStaleBatch/);
  });
});
