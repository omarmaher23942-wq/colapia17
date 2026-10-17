import { describe, expect, it } from "vitest";
import { cleanOrderPrefix, formatOrderCode, orderCodeCandidates } from "@/lib/order-code";
import { OWNER_COOKIE, safeLandingPath, signOwnerPass, verifyOwnerPass } from "@/lib/owner-pass";
import { DEVICE_ID_RE, newDeviceId, signParts, verifyParts } from "@/lib/signed-token";
import { abandonedBefore, isAbandonedCart } from "@/lib/abandoned";
import { buildTimeline, canRequestCancel, returnKindsAllowed, returnWindow, validateReturnLines } from "@/lib/order-requests";
import { addDeliveryDays, deliveryRange, exactAmount, firstErrorField, validateCheckout } from "@/lib/checkout-form";

const SECRET = "x".repeat(40);

describe("رقم الطلب", () => {
  it("بادئة افتراضية # وتسلسل", () => {
    expect(formatOrderCode(undefined, 1001)).toBe("#1001");
    expect(formatOrderCode("ab-", 7)).toBe("AB-7");
    expect(cleanOrderPrefix("$$")).toBe("#");
    expect(cleanOrderPrefix("toolongprefix")).toBe("TOOLON");
  });
  it("يقبل الرقم بلا بادئة وبالأرقام العربية", () => {
    expect(orderCodeCandidates("١٠٤٢", "#")).toEqual(["1042", "#1042"]);
    expect(orderCodeCandidates("#1042", "#")).toEqual(["#1042"]);
    expect(orderCodeCandidates("", "#")).toEqual([]);
  });
});

describe("تمرير المالك", () => {
  const p = { storeId: "s1", sub: "nova", merchantId: "m1", ttlSeconds: 60 };
  it("توقيع وتحقق", async () => {
    const t = await signOwnerPass(p, SECRET);
    const v = await verifyOwnerPass(t, SECRET, { sub: "nova" });
    expect(v).toMatchObject({ s: "s1", u: "nova", m: "m1" });
    expect(OWNER_COOKIE).toBe("clp_own");
  });
  it("يرفض سراً آخر وعبثاً ونطاقاً آخر", async () => {
    const t = await signOwnerPass(p, SECRET);
    expect(await verifyOwnerPass(t, "y".repeat(40))).toBeNull();
    expect(await verifyOwnerPass(t, SECRET, { sub: "other" })).toBeNull();
    const [b, s] = t.split(".");
    expect(await verifyOwnerPass(`${b}x.${s}`, SECRET)).toBeNull();
    expect(await verifyOwnerPass("junk", SECRET)).toBeNull();
    expect(await verifyOwnerPass(null, SECRET)).toBeNull();
  });
  it("ينتهي", async () => {
    const now = Date.now();
    const t = await signOwnerPass(p, SECRET, now);
    expect(await verifyOwnerPass(t, SECRET, { nowMs: now + 30_000 })).not.toBeNull();
    expect(await verifyOwnerPass(t, SECRET, { nowMs: now + 61_000 })).toBeNull();
  });
  it("وجهة آمنة", () => {
    expect(safeLandingPath("/checkout")).toBe("/checkout");
    expect(safeLandingPath("//evil.com")).toBe("/");
    expect(safeLandingPath("https://evil.com")).toBe("/");
    expect(safeLandingPath("/a\\b")).toBe("/");
    expect(safeLandingPath(null)).toBe("/");
  });
});

describe("هوية الجهاز ورابط طلباتي", () => {
  it("المعرّف عشوائي بالصيغة المقبولة", () => {
    const a = newDeviceId();
    expect(DEVICE_ID_RE.test(a)).toBe(true);
    expect(newDeviceId()).not.toBe(a);
  });
  it("الرمز مرتبط بالمتجر والطلب", () => {
    const t = signParts(SECRET, "olink", "store1", "order1");
    expect(verifyParts(SECRET, t, "olink", "store1", "order1")).toBe(true);
    expect(verifyParts(SECRET, t, "olink", "store1", "order2")).toBe(false);
    expect(verifyParts(SECRET, t, "olink", "store2", "order1")).toBe(false);
    expect(verifyParts(SECRET, t, "confirm", "store1", "order1")).toBe(false);
    expect(verifyParts(SECRET, undefined, "olink", "store1", "order1")).toBe(false);
  });
});

describe("السلة المتروكة", () => {
  const now = Date.parse("2026-10-17T12:00:00Z");
  it("بعد 45 دقيقة فقط", () => {
    expect(isAbandonedCart({ lastSeenAt: new Date(now - 44 * 60_000) }, now)).toBe(false);
    expect(isAbandonedCart({ lastSeenAt: new Date(now - 45 * 60_000) }, now)).toBe(true);
  });
  it("المستردة ليست متروكة", () => {
    expect(isAbandonedCart({ lastSeenAt: new Date(now - 3600_000), recoveredOrderId: "o1" }, now)).toBe(false);
  });
  it("حد SQL", () => {
    expect(abandonedBefore(now).getTime()).toBe(now - 45 * 60_000);
  });
});

describe("طلبات ما بعد الشراء", () => {
  it("الإلغاء قبل التجهيز ولمرة واحدة", () => {
    expect(canRequestCancel({ status: "new" })).toBe(true);
    expect(canRequestCancel({ status: "confirmed" })).toBe(true);
    expect(canRequestCancel({ status: "preparing" })).toBe(false);
    expect(canRequestCancel({ status: "new", cancelRequestedAt: new Date() })).toBe(false);
  });
  it("نافذة الاستبدال", () => {
    const now = Date.parse("2026-10-17T00:00:00Z");
    const d = new Date(now - 3 * 86_400_000);
    expect(returnWindow({ status: "delivered", deliveredAt: d }, 14, now)).toMatchObject({ open: true, daysLeft: 11 });
    expect(returnWindow({ status: "delivered", deliveredAt: d }, 3, now)).toMatchObject({ open: false, reason: "expired" });
    expect(returnWindow({ status: "shipped" }, 14, now)).toMatchObject({ open: false, reason: "not_delivered" });
    expect(returnWindow({ status: "delivered", deliveredAt: d }, 0, now)).toMatchObject({ open: false, reason: "disabled" });
  });
  it("أنواع الطلب المسموحة", () => {
    expect(returnKindsAllowed({ allowExchange: true, allowRefund: false })).toEqual(["exchange"]);
    expect(returnKindsAllowed({ allowExchange: false, allowRefund: false })).toEqual([]);
  });
  it("التحقق من الأسطر", () => {
    const items = [{ id: "i1", quantity: 2, unitPiasters: 100 }, { id: "g", quantity: 1, unitPiasters: 0 }];
    expect(validateReturnLines([], items)).toBeTruthy();
    expect(validateReturnLines([{ orderItemId: "x", qty: 1 }], items)).toBeTruthy();
    expect(validateReturnLines([{ orderItemId: "i1", qty: 3 }], items)).toBeTruthy();
    expect(validateReturnLines([{ orderItemId: "g", qty: 1 }], items)).toBeTruthy();
    expect(validateReturnLines([{ orderItemId: "i1", qty: 1 }, { orderItemId: "i1", qty: 1 }], items)).toBeTruthy();
    expect(validateReturnLines([{ orderItemId: "i1", qty: 2 }], items)).toBeNull();
  });
  it("الخط الزمني", () => {
    const t = buildTimeline("shipped", [{ status: "confirmed", at: "2026-10-01T10:00:00Z" }], "2026-10-01T09:00:00Z");
    expect(t.map((s) => s.state)).toEqual(["done", "done", "done", "current", "todo"]);
    expect(t[0]!.at).toBe("2026-10-01T09:00:00.000Z");
    const c = buildTimeline("cancelled", [{ status: "new", at: "x" }]);
    expect(c.at(-1)).toMatchObject({ key: "cancelled", state: "current" });
    expect(buildTimeline("delivered", []).every((s) => s.state === "done")).toBe(true);
  });
});

describe("نموذج الدفع", () => {
  const ok = { name: "أحمد علي", phone: "٠١٠١٢٣٤٥٦٧٨", altPhone: "", governorate: "cairo", address: "شارع التحرير عمارة 5", paymentMethod: "cod" as const, transferScreenshotUrl: "" };
  it("يقبل الأرقام العربية و+20", () => {
    expect(validateCheckout(ok, { requireProof: true })).toEqual({});
    expect(validateCheckout({ ...ok, phone: "+201012345678" }, { requireProof: true })).toEqual({});
  });
  it("أخطاء كل حقل وأولها", () => {
    const e = validateCheckout({ ...ok, name: "", phone: "123", governorate: "", address: "ab" }, { requireProof: true });
    expect(Object.keys(e).sort()).toEqual(["address", "governorate", "name", "phone"]);
    expect(firstErrorField(e)).toBe("name");
  });
  it("الإيصال مطلوب للتحويل فقط", () => {
    expect(validateCheckout({ ...ok, paymentMethod: "instapay" }, { requireProof: true }).transferScreenshotUrl).toBeTruthy();
    expect(validateCheckout({ ...ok, paymentMethod: "instapay" }, { requireProof: false })).toEqual({});
    expect(validateCheckout({ ...ok, altPhone: "12" }, { requireProof: true }).altPhone).toBeTruthy();
  });
  it("مبلغ التحويل بالقروش", () => {
    expect(exactAmount(125050)).toBe("1250.50");
    expect(exactAmount(125000)).toBe("1250");
    expect(exactAmount(105)).toBe("1.05");
  });
  it("موعد التوصيل يتخطى الجمعة", () => {
    const thu = new Date("2026-10-15T09:00:00Z"); // خميس
    expect(addDeliveryDays(thu, 1).getUTCDay()).toBe(6); // السبت
    expect(deliveryRange(thu, 2, 4)).toContain("إلى");
    expect(deliveryRange(thu, 1, 1)).not.toContain("إلى");
  });
});
