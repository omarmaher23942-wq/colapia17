import { describe, expect, it } from "vitest";
import { doneLine, growthTask, todayTasks, type TodayExtras } from "@/lib/today-tasks";
import type { AttentionCounts } from "@/server/repos/attention";

const zero: AttentionCounts = { newOrders: 0, ordersToHandle: 0, receipts: 0, pendingReviews: 0, outOfStock: 0, lowStock: 0, variantsOut: 0, abandoned: 0, restockReady: 0 };
const quiet: TodayExtras = { stuckPrep: 0, staleShipped: 0, done: { confirmed: 0, shipped: 0, delivered: 0, asked: 0 }, quietDays: 1, activeProducts: 5 };

describe("todayTasks", () => {
  it("orders money and customers first, stock and carts after", () => {
    const t = todayTasks({ ...zero, abandoned: 2, newOrders: 1, lowStock: 1, receipts: 1 }, { ...quiet, stuckPrep: 2, staleShipped: 1 });
    expect(t.map((x) => x.key)).toEqual(["new", "receipts", "stuck", "shipped", "low", "carts"]);
    expect(t.filter((x) => x.urgent).map((x) => x.key)).toEqual(["new", "receipts", "stuck", "shipped"]);
  });

  it("is empty when nothing waits and orders are recent", () => {
    expect(todayTasks(zero, quiet)).toEqual([]);
  });

  it("suggests sharing only when quiet and nothing urgent", () => {
    expect(todayTasks(zero, { ...quiet, quietDays: 4 }).map((x) => x.key)).toEqual(["share"]);
    expect(todayTasks({ ...zero, newOrders: 1 }, { ...quiet, quietDays: 4 }).map((x) => x.key)).toEqual(["new"]);
    expect(todayTasks({ ...zero, lowStock: 1 }, { ...quiet, quietDays: 4 }).map((x) => x.key)).toEqual(["low", "share"]);
  });

  it("never suggests sharing an empty store", () => {
    expect(growthTask({ ...quiet, quietDays: null, activeProducts: 0 })).toBeNull();
    expect(growthTask({ ...quiet, quietDays: null })?.title).toBe("انشر متجرك لأول طلب");
  });
});

describe("doneLine", () => {
  it("lists only what was done", () => {
    expect(doneLine(quiet.done)).toBeNull();
    expect(doneLine({ confirmed: 3, shipped: 0, delivered: 1, asked: 2 })).toBe("أُنجز اليوم: 3 تأكيد · 1 تسليم · 2 طلب تقييم");
  });
});
