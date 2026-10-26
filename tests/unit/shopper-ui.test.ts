import { describe, expect, it } from "vitest";
import { arrangeReviews, cartShareText, cartWhatsappMessage, deliveryIcs, formatPhoneLive, parseSharedWishlist, priceDrop, recommendPercent, reviewPhotos, sanitizeDraft, statusChanges, wishlistShareUrl } from "@/lib/shopper-ui";

describe("shopper-ui", () => {
  const lines = [{ name: "قميص", qty: 2, unitPiasters: 25000, variantLabel: "M", slug: "shirt" }];
  it("رسالة واتساب للسلة", () => {
    const m = cartWhatsappMessage(lines, { storeName: "نور", totalPiasters: 50000, url: "https://x.y" });
    expect(m).toContain("قميص (M) × 2");
    expect(m).toContain("https://x.y");
  });
  it("مشاركة السلة بروابط المنتجات", () => {
    expect(cartShareText(lines, "https://s.com", "نور")).toContain("https://s.com/p/shirt");
  });
  it("مشاركة المفضلة", () => {
    const u = wishlistShareUrl("https://s.com", ["a", "b"]);
    expect(parseSharedWishlist(new URL(u).searchParams.get("items"))).toEqual(["a", "b"]);
    expect(parseSharedWishlist("a,a,,b")).toEqual(["a", "b"]);
    expect(parseSharedWishlist(null)).toEqual([]);
  });
  it("انخفاض السعر", () => {
    expect(priceDrop(10000, 8000)).toEqual({ fromPiasters: 10000, percent: 20 });
    expect(priceDrop(10000, 10000)).toBeNull();
    expect(priceDrop(undefined, 5)).toBeNull();
  });
  it("تنسيق الهاتف", () => {
    expect(formatPhoneLive("٠١٠١٢٣٤٥٦٧٨")).toBe("010 1234 5678");
    expect(formatPhoneLive("+201012345678")).toBe("010 1234 5678");
    expect(formatPhoneLive("0101")).toBe("010 1");
  });
  it("المسودة تحتفظ بالحقول المعروفة فقط", () => {
    expect(sanitizeDraft({ name: "أحمد", evil: "x", address: " ", phone: 5 })).toEqual({ name: "أحمد" });
    expect(sanitizeDraft(null)).toEqual({});
  });
  it("تغيّر حالات الطلب", () => {
    const c = statusChanges({ A: "new", B: "shipped" }, [{ code: "A", status: "shipped" }, { code: "B", status: "shipped" }, { code: "C", status: "confirmed" }]);
    expect(c.map((x) => x.code)).toEqual(["A"]);
  });
  it("ملف التقويم", () => {
    const ics = deliveryIcs({ code: "CLP-1", storeName: "نور", from: new Date("2026-10-20T00:00:00Z"), to: new Date("2026-10-22T00:00:00Z"), stamp: new Date("2026-10-18T00:00:00Z") });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261020");
    expect(ics).toContain("DTEND;VALUE=DATE:20261023");
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
  });
  it("ترتيب التقييمات وتصفيتها", () => {
    const rows = [
      { rating: 5, body: "a", imageUrls: ["u1"], createdAt: "2026-01-01" },
      { rating: 3, body: "b", imageUrls: null, createdAt: "2026-02-01" },
      { rating: 5, body: "c", imageUrls: [], createdAt: "2026-03-01" },
    ];
    expect(arrangeReviews(rows, "newest", { stars: null, withPhotos: false }).map((r) => r.body)).toEqual(["c", "b", "a"]);
    expect(arrangeReviews(rows, "lowest", { stars: null, withPhotos: false })[0]!.body).toBe("b");
    expect(arrangeReviews(rows, "highest", { stars: 5, withPhotos: true }).map((r) => r.body)).toEqual(["a"]);
    expect(reviewPhotos(rows)).toEqual(["u1"]);
  });
  it("نسبة التوصية", () => {
    expect(recommendPercent({ 5: 4, 4: 1, 1: 1 })).toBe(83);
    expect(recommendPercent({ 5: 2 })).toBeNull();
  });
});
