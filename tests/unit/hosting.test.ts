import { describe, expect, it } from "vitest";
import { addMonths, canRenewNow, extendHosting, graceDaysFrom, hostingExpiry, hostingServes, hostingState, HOSTING_GRACE_DAYS, type HostingStore } from "@/lib/hosting";

const D = 864e5;
const now = new Date("2027-03-01T12:00:00Z");
const store = (p: Partial<HostingStore> = {}): HostingStore => ({
  status: "active",
  activatedAt: new Date(now.getTime() - 100 * D),
  hostingExpiresAt: new Date(now.getTime() + 265 * D),
  ...p,
});

describe("حالة الاستضافة", () => {
  it("سارية بعيدة: تعمل ولا يُفتح التجديد بعد", () => {
    const s = hostingState(store(), now);
    expect(s.phase).toBe("active");
    expect(hostingServes(s)).toBe(true);
    expect(canRenewNow(s)).toBe(false);
  });

  it("قبل الانتهاء بـ 20 يوماً: تذكير والتجديد مفتوح", () => {
    const s = hostingState(store({ hostingExpiresAt: new Date(now.getTime() + 20 * D) }), now);
    expect(s.phase).toBe("renew_soon");
    expect(canRenewNow(s)).toBe(true);
  });

  it("قبل الانتهاء بـ 50 يوماً: التجديد مفتوح دون تذكير", () => {
    const s = hostingState(store({ hostingExpiresAt: new Date(now.getTime() + 50 * D) }), now);
    expect(s.phase).toBe("active");
    expect(canRenewNow(s)).toBe(true);
  });

  it("بعد الانتهاء: سماح والمتجر يعمل، ثم إيقاف بلا حذف", () => {
    const grace = hostingState(store({ hostingExpiresAt: new Date(now.getTime() - 2 * D) }), now);
    expect(grace.phase).toBe("grace");
    expect(hostingServes(grace)).toBe(true);
    const paused = hostingState(store({ hostingExpiresAt: new Date(now.getTime() - (HOSTING_GRACE_DAYS + 1) * D) }), now);
    expect(paused.phase).toBe("paused");
    expect(hostingServes(paused)).toBe(false);
    expect(canRenewNow(paused)).toBe(true);
  });

  it("متجر قديم بلا عمود: مدة الباقة من التفعيل (12 شهراً افتراضياً)", () => {
    const s = hostingState(store({ hostingExpiresAt: null, activatedAt: new Date(now.getTime() - 366 * D) }), now);
    expect(s.phase).toBe("grace");
    const three = hostingState(store({ hostingExpiresAt: null, planMonths: 3, activatedAt: new Date(now.getTime() - 30 * D) }), now);
    expect(three.phase).toBe("active");
  });

  it("مهلة السماح قابلة للضبط (صفر = إيقاف عند الانتهاء مباشرة)", () => {
    const expired = store({ hostingExpiresAt: new Date(now.getTime() - 2 * D) });
    expect(hostingState(expired, now, 0).phase).toBe("paused");
    expect(hostingState(expired, now, 7).phase).toBe("grace");
    expect(graceDaysFrom(undefined)).toBe(HOSTING_GRACE_DAYS);
    expect(graceDaysFrom(5)).toBe(5);
    expect(graceDaysFrom(99)).toBe(HOSTING_GRACE_DAYS);
  });

  it("لا مرحلة «lifetime»: الدائرة الذهبية باقة بمدة لها تاريخ انتهاء", () => {
    const g = hostingState(store({ plan: "golden", planMonths: 3, hostingExpiresAt: new Date(now.getTime() + 80 * D) }), now);
    expect(["active", "renew_soon"]).toContain(g.phase);
    expect(hostingExpiry(store({ plan: "golden", hostingExpiresAt: null, planMonths: 3, activatedAt: now }))).toEqual(addMonths(now, 3));
  });

  it("غير مفعّل: لا اشتراك", () => {
    expect(hostingState(store({ status: "trial" }), now).phase).toBe("none");
  });
});

describe("تمديد الاستضافة", () => {
  it("يُضاف لنهاية الاشتراك الحالي فلا يخسر التاجر يوماً", () => {
    const end = new Date(now.getTime() + 10 * D);
    expect(extendHosting(end, 12, now)).toEqual(addMonths(end, 12));
    expect(extendHosting(end, 3, now)).toEqual(addMonths(end, 3));
  });
  it("بعد الانتهاء يبدأ من اليوم لا من تاريخ قديم", () => {
    expect(extendHosting(new Date(now.getTime() - 30 * D), 6, now)).toEqual(addMonths(now, 6));
    expect(extendHosting(null, 3, now)).toEqual(addMonths(now, 3));
  });
  it("مدة غير صالحة تعود لـ12 شهراً", () => {
    expect(extendHosting(null, 0, now)).toEqual(addMonths(now, 12));
  });
  it("إضافة الأشهر تقف عند آخر يوم في الشهر", () => {
    expect(addMonths(new Date("2027-01-31T10:00:00Z"), 1).toISOString()).toBe("2027-02-28T10:00:00.000Z");
    expect(addMonths(new Date("2027-03-15T10:00:00Z"), 12).toISOString()).toBe("2028-03-15T10:00:00.000Z");
  });
});
