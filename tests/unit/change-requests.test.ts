import { describe, expect, it } from "vitest";
import { DEFAULT_PER_YEAR, perYearFrom, quotaPeriodEnd, quotaPeriodStart, remainingQuota } from "@/lib/change-requests";

describe("حصة طلبات التعديل لكل سنة اشتراك", () => {
  it("الافتراضي طلبان لكل سنة، وإعداد perYear يضبطها", () => {
    expect(DEFAULT_PER_YEAR).toBe(2);
    expect(perYearFrom(null)).toBe(2);
    expect(perYearFrom({ perYear: 4 })).toBe(4);
    expect(perYearFrom({ perYear: 0 })).toBe(0);
    expect(perYearFrom({ perYear: -1 })).toBe(2);
    expect(perYearFrom({ perYear: 3.5 })).toBe(2);
    // الإعداد الشهري القديم لا يُفسَّر سنوياً.
    expect(perYearFrom({ perMonth: 9 })).toBe(2);
  });

  it("السنة الأولى تبدأ من التفعيل", () => {
    const act = new Date("2026-10-17T10:00:00Z");
    expect(quotaPeriodStart(act, new Date("2027-03-01T00:00:00Z"))).toEqual(act);
    expect(quotaPeriodEnd(act, new Date("2027-03-01T00:00:00Z"))).toEqual(new Date("2027-10-17T10:00:00Z"));
  });

  it("بعد سنة كاملة تبدأ حصة جديدة في ذكرى التفعيل", () => {
    const act = new Date("2026-10-17T10:00:00Z");
    expect(quotaPeriodStart(act, new Date("2027-10-17T10:00:00Z"))).toEqual(new Date("2027-10-17T10:00:00Z"));
    expect(quotaPeriodStart(act, new Date("2027-10-17T09:59:00Z"))).toEqual(act);
    expect(quotaPeriodStart(act, new Date("2029-01-01T00:00:00Z"))).toEqual(new Date("2028-10-17T10:00:00Z"));
  });

  it("باقة قصيرة (3 أشهر) لا تمنح حصة جديدة قبل مرور سنة على التفعيل", () => {
    const act = new Date("2026-10-17T10:00:00Z");
    // تجديد بعد 3 أشهر و6 أشهر: الحصة نفسها.
    expect(quotaPeriodStart(act, new Date("2027-01-20T00:00:00Z"))).toEqual(act);
    expect(quotaPeriodStart(act, new Date("2027-07-20T00:00:00Z"))).toEqual(act);
  });

  it("29 فبراير يتحول إلى آخر فبراير في السنوات غير الكبيسة", () => {
    const act = new Date("2028-02-29T10:00:00Z");
    expect(quotaPeriodStart(act, new Date("2029-03-01T00:00:00Z"))).toEqual(new Date("2029-02-28T10:00:00Z"));
  });

  it("بلا تفعيل (تجربة) تُحسب كل الطلبات، وتفعيل مستقبلي لا يكسر شيئاً", () => {
    expect(quotaPeriodStart(null).getTime()).toBe(0);
    expect(quotaPeriodEnd(null)).toBeNull();
    const future = new Date(Date.now() + 864e5);
    expect(quotaPeriodStart(future)).toEqual(future);
  });

  it("المتبقي لا يقل عن صفر", () => {
    expect(remainingQuota(0, 2)).toBe(2);
    expect(remainingQuota(1, 2)).toBe(1);
    expect(remainingQuota(5, 2)).toBe(0);
  });
});
