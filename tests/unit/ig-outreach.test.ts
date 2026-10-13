import { describe, expect, it } from "vitest";
import { cleanOpener, daySlots, handleFrom, nextSlots, outreachSettingsFrom, parseLeadLines } from "@/lib/ig-outreach";
import { cairoDate, cairoOffsetMinutes } from "@/lib/cairo-time";

describe("outreach leads", () => {
  it("reads handles from links, @names and bare names", () => {
    expect(handleFrom("https://www.instagram.com/Nour.Brand/?igsh=abc")).toBe("nour.brand");
    expect(handleFrom("instagram.com/nour_brand")).toBe("nour_brand");
    expect(handleFrom("@Nour")).toBe("nour");
    expect(handleFrom("https://instagram.com/p/xyz")).toBeNull();
    expect(handleFrom("https://facebook.com/x")).toBeNull();
    expect(handleFrom("bad name")).toBeNull();
  });
  it("parses lines with notes and drops duplicates", () => {
    const r = parseLeadLines("https://instagram.com/a.b | فساتين سواريه\n@a.b\nhttps://facebook.com/x\n\nc_d - عبايات");
    expect(r.leads).toEqual([
      { handle: "a.b", note: "فساتين سواريه" },
      { handle: "c_d", note: "عبايات" },
    ]);
    expect(r.invalid).toEqual(["https://facebook.com/x"]);
  });
  it("settings stay in safe bounds", () => {
    expect(outreachSettingsFrom(null)).toEqual({ dailyCap: 18, startHour: 11, endHour: 22 });
    expect(outreachSettingsFrom({ dailyCap: 99, startHour: 21, endHour: 21 })).toEqual({ dailyCap: 18, startHour: 21, endHour: 23 });
  });
  it("spreads a day's slots inside the Cairo window", () => {
    const s = { dailyCap: 18, startHour: 11, endHour: 22 };
    const slots = daySlots({ y: 2026, m: 10, d: 13 }, s);
    expect(slots).toHaveLength(18);
    for (const t of slots) {
      const local = (t.getUTCHours() * 60 + t.getUTCMinutes() + cairoOffsetMinutes(t)) % 1440;
      expect(local).toBeGreaterThanOrEqual(11 * 60);
      expect(local).toBeLessThan(22 * 60);
    }
    const gaps = slots.slice(1).map((t, i) => (t.getTime() - slots[i]!.getTime()) / 60_000);
    expect(Math.min(...gaps)).toBeGreaterThan(20);
  });
  it("never exceeds the daily cap and rolls to the next days", () => {
    const s = { dailyCap: 15, startHour: 11, endHour: 22 };
    const now = new Date("2026-10-13T06:00:00Z"); // 09:00 Cairo
    const slots = nextSlots(now, 40, [], s);
    expect(slots).toHaveLength(40);
    const perDay = new Map<number, number>();
    for (const t of slots) perDay.set(cairoDate(t).d, (perDay.get(cairoDate(t).d) ?? 0) + 1);
    expect([...perDay.values()]).toEqual([15, 15, 10]);
    // ما أُرسل اليوم يُحسب من الحد
    const sentToday = Array.from({ length: 15 }, (_, i) => new Date(now.getTime() + i * 60_000));
    expect(cairoDate(nextSlots(now, 1, sentToday, s)[0]!).d).toBe(14);
  });
  it("opener cleanup rejects links and prices", () => {
    const ok = "مساء الخير يا نور ✨ بنتابع شغلكم والكولكشن الأخير جميل جداً. ممكن توصّلونا بصاحب البراند؟ عندنا عرض يفرق في طلبات إنستجرام.";
    expect(cleanOpener(ok)).toBe(ok);
    expect(cleanOpener(ok + " colapia.com")).toBeNull();
    expect(cleanOpener(ok + " بـ 599 جنيه")).toBeNull();
    expect(cleanOpener("قصير")).toBeNull();
  });
});

import { customerOrderWhatsApp } from "@/lib/order-messages";
describe("customer order whatsapp", () => {
  it("carries the order code, items and total", () => {
    const t = customerOrderWhatsApp(
      { code: "CLP-1002", customerName: "مريم", totalPiasters: 45900, items: [{ name: "صندل", variantLabel: "38", quantity: 1 }] },
      "نوفا",
      (p) => `${p / 100} ج`
    );
    expect(t).toContain("رقم الطلب: CLP-1002");
    expect(t).toContain("• صندل (38) × 1");
    expect(t).toContain("الإجمالي: 459 ج");
  });
});

import { depositMessage, suggestedDeposit } from "@/lib/order-messages";
describe("COD shield deposit", () => {
  it("suggests shipping or 10% (min 50, rounded to 10) and never above total", () => {
    expect(suggestedDeposit({ totalPiasters: 90000, shippingPiasters: 6000 })).toBe(6000);
    expect(suggestedDeposit({ totalPiasters: 123400, shippingPiasters: 0 })).toBe(13000);
    expect(suggestedDeposit({ totalPiasters: 20000, shippingPiasters: 0 })).toBe(5000);
    expect(suggestedDeposit({ totalPiasters: 3000, shippingPiasters: 0 })).toBe(3000);
  });
  it("states amount, real payment ways and the remainder", () => {
    const t = depositMessage({ customerName: "مريم أحمد", code: "CLP-1", totalPiasters: 90000 }, "نوفا", 6000, { vodafone: "01012345678", instapay: null });
    expect(t).toContain("أهلاً مريم");
    expect(t).toContain("فودافون كاش على 01012345678");
    expect(t).not.toContain("إنستاباي");
    expect(t).toMatch(/الباقي عند الاستلام: 840/);
  });
});
