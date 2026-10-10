import { describe, expect, it } from "vitest";
import { canRenewNow, extendHosting, hostingServes, hostingState, HOSTING_GRACE_DAYS, type HostingStore } from "@/lib/hosting";

const D = 864e5;
const now = new Date("2027-03-01T12:00:00Z");
const store = (p: Partial<HostingStore> = {}): HostingStore => ({
  status: "active",
  activatedAt: new Date(now.getTime() - 100 * D),
  hostingExpiresAt: new Date(now.getTime() + 265 * D),
  platformOfflineAt: null,
  purgedAt: null,
  ...p,
});

describe("حالة الاستضافة", () => {
  it("سارية بعيدة: تعمل ولا يُفتح التجديد بعد", () => {
    const s = hostingState(store(), now, "platform");
    expect(s.phase).toBe("active");
    expect(hostingServes(s)).toBe(true);
    expect(canRenewNow(s)).toBe(false);
  });

  it("قبل الانتهاء بـ 20 يوماً: تذكير والتجديد مفتوح", () => {
    const s = hostingState(store({ hostingExpiresAt: new Date(now.getTime() + 20 * D) }), now, "platform");
    expect(s.phase).toBe("renew_soon");
    expect(canRenewNow(s)).toBe(true);
  });

  it("قبل الانتهاء بـ 50 يوماً: التجديد مفتوح دون تذكير", () => {
    const s = hostingState(store({ hostingExpiresAt: new Date(now.getTime() + 50 * D) }), now, "platform");
    expect(s.phase).toBe("active");
    expect(canRenewNow(s)).toBe(true);
  });

  it("بعد الانتهاء: سماح والمتجر يعمل، ثم إيقاف بلا حذف", () => {
    const grace = hostingState(store({ hostingExpiresAt: new Date(now.getTime() - 3 * D) }), now, "platform");
    expect(grace.phase).toBe("grace");
    expect(hostingServes(grace)).toBe(true);
    const paused = hostingState(store({ hostingExpiresAt: new Date(now.getTime() - (HOSTING_GRACE_DAYS + 1) * D) }), now, "platform");
    expect(paused.phase).toBe("paused");
    expect(hostingServes(paused)).toBe(false);
    expect(canRenewNow(paused)).toBe(true);
  });

  it("متجر قديم بلا عمود: سنة من التفعيل", () => {
    const s = hostingState(store({ hostingExpiresAt: null, activatedAt: new Date(now.getTime() - 370 * D) }), now, "platform");
    expect(s.phase).toBe("grace");
  });

  it("إيقاف التاجر نسخته أو حذف بياناتها: offline", () => {
    expect(hostingState(store({ platformOfflineAt: now }), now, "platform").phase).toBe("offline");
    expect(hostingState(store({ purgedAt: now }), now, "platform").phase).toBe("offline");
  });

  it("غير مفعّل أو مشروع التاجر: لا اشتراك", () => {
    expect(hostingState(store({ status: "trial" }), now, "platform").phase).toBe("none");
    expect(hostingState(store(), now, "store").phase).toBe("none");
  });
});

describe("تمديد الاستضافة", () => {
  it("يُضاف لنهاية الاشتراك الحالي فلا يخسر التاجر يوماً", () => {
    const end = new Date(now.getTime() + 10 * D);
    expect(extendHosting(end, now).getTime()).toBe(end.getTime() + 365 * D);
  });
  it("بعد الانتهاء يبدأ من اليوم لا من تاريخ قديم", () => {
    expect(extendHosting(new Date(now.getTime() - 30 * D), now).getTime()).toBe(now.getTime() + 365 * D);
    expect(extendHosting(null, now).getTime()).toBe(now.getTime() + 365 * D);
  });
});
