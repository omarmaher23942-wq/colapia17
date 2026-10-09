import { describe, expect, it } from "vitest";
import { buildNotes, type NotesInput } from "@/components/dashboard/overview/notes";
import { waLink, waNumber } from "@/lib/whatsapp";
import { lastCairoDays } from "@/server/repos/overview";

const base: NotesInput = {
  days: 30,
  current: { orders: 0, sales: 0, visits: 0 },
  previous: { orders: 0, sales: 0, visits: 0 },
  topProduct: null,
  viewedNotBought: null,
  silentRepeat: 0,
  hasOrdersEver: true,
  shareHref: "/dashboard/store",
};

describe("overview notes", () => {
  it("invites a store without orders to share its link", () => {
    const notes = buildNotes({ ...base, hasOrdersEver: false });
    expect(notes.map((n) => n.id)).toEqual(["first-order"]);
    expect(notes[0]!.action?.href).toBe("/dashboard/store");
  });

  it("does not compare periods without enough previous orders", () => {
    const notes = buildNotes({ ...base, current: { orders: 9, sales: 900_00, visits: 300 }, previous: { orders: 2, sales: 100_00, visits: 200 } });
    expect(notes.find((n) => n.id.startsWith("sales"))).toBeUndefined();
  });

  it("explains a sales drop by traffic when visits dropped too", () => {
    const notes = buildNotes({ ...base, current: { orders: 5, sales: 500_00, visits: 100 }, previous: { orders: 10, sales: 1000_00, visits: 200 } });
    const n = notes.find((x) => x.id === "sales-down")!;
    expect(n.title).toContain("50%");
    expect(n.body).toContain("الزيارات أقل");
  });

  it("points to the funnel when traffic held but sales dropped", () => {
    const notes = buildNotes({ ...base, current: { orders: 5, sales: 500_00, visits: 200 }, previous: { orders: 10, sales: 1000_00, visits: 200 } });
    expect(notes.find((x) => x.id === "sales-down")!.action?.label).toBe("مراحل الشراء");
  });

  it("never makes claims that are not computed from the store", () => {
    const notes = buildNotes({
      ...base,
      current: { orders: 20, sales: 3000_00, visits: 900 },
      previous: { orders: 10, sales: 1000_00, visits: 600 },
      topProduct: { name: "فستان", qty: 6 },
      viewedNotBought: { id: "p1", name: "قميص", viewers: 40 },
      silentRepeat: 3,
    });
    expect(notes).toHaveLength(3);
    for (const n of notes) expect(`${n.title} ${n.body}`).not.toMatch(/[0-9]+×|20%|5 أضعاف/);
  });
});

describe("whatsapp links", () => {
  it.each([
    ["01012345678", "201012345678"],
    ["+20 101 234 5678", "201012345678"],
    ["00201012345678", "201012345678"],
    ["١٠١٢٣٤٥٦٧٨", "201012345678"],
    ["٠١٠١٢٣٤٥٦٧٨", "201012345678"],
  ])("%s → %s", (input, out) => expect(waNumber(input)).toBe(out));

  it("rejects non-Egyptian-mobile input", () => {
    expect(waNumber("0223456789")).toBeNull();
    expect(waLink("", "x")).toBeNull();
  });
});

describe("cairo day keys", () => {
  it("returns n consecutive days ending today", () => {
    const days = lastCairoDays(7, new Date("2026-10-09T21:30:00Z"));
    expect(days).toHaveLength(7);
    expect(days.at(-1)).toBe("2026-10-10"); // 00:30 بتوقيت القاهرة
  });
});
