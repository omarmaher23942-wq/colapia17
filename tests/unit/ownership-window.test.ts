import { describe, expect, it } from "vitest";
import { OWN_POLICY_SINCE, OWN_PURGE_DAYS, OWN_WINDOW_HOURS, ownWindow } from "@/lib/ownership-window";

const H = 36e5;
const activatedAt = new Date("2026-11-01T10:00:00Z");
const at = (h: number) => new Date(activatedAt.getTime() + h * H);
const store = { status: "active", activatedAt, ownedAt: null };

describe("مهلة نقل المتجر بعد الدفع", () => {
  it("مفتوحة من التفعيل حتى نهاية المهلة", () => {
    const w = ownWindow(store, at(10), "platform");
    expect(w.phase).toBe("open");
    if (w.phase !== "open") return;
    expect(w.msLeft).toBe((OWN_WINDOW_HOURS - 10) * H);
    expect(w.deadline).toEqual(at(OWN_WINDOW_HOURS));
    expect(w.purgeAt).toEqual(at(OWN_WINDOW_HOURS + OWN_PURGE_DAYS * 24));
  });

  it("تنتهي بعد المهلة ما لم يكتمل النقل", () => {
    expect(ownWindow(store, at(OWN_WINDOW_HOURS + 1), "platform").phase).toBe("overdue");
    expect(ownWindow({ ...store, ownedAt: at(5) }, at(OWN_WINDOW_HOURS + 1), "platform").phase).toBe("owned");
  });

  it("لا مهلة لمتجر لم يُفعَّل، ولا داخل مشروع التاجر", () => {
    expect(ownWindow({ ...store, status: "trial" }, at(1), "platform").phase).toBe("none");
    expect(ownWindow(store, at(OWN_WINDOW_HOURS + 100), "store").phase).toBe("none");
  });

  it("متجر فُعِّل قبل بدء المهلة يأخذ مهلته كاملة من تاريخ بدئها", () => {
    const old = { ...store, activatedAt: new Date("2026-09-01T10:00:00Z") };
    const w = ownWindow(old, new Date(OWN_POLICY_SINCE.getTime() + H), "platform");
    expect(w.phase).toBe("open");
  });
});
