import { describe, expect, it } from "vitest";
import { MAX_OPEN_ORDERS_PER_PHONE, MAX_ORDERS_PER_PHONE_DAY, phoneOrderBlock } from "@/lib/order-spam";

describe("حماية التاجر من الطلبات المتكررة", () => {
  it("يسمح بالطلب العادي وبطلب ثانٍ مفتوح", () => {
    expect(phoneOrderBlock({ open: 0, lastDay: 0 })).toBeNull();
    expect(phoneOrderBlock({ open: MAX_OPEN_ORDERS_PER_PHONE - 1, lastDay: 2 })).toBeNull();
  });
  it("يوقف عند كثرة الطلبات المفتوحة أو اليومية برسالة مهذبة", () => {
    expect(phoneOrderBlock({ open: MAX_OPEN_ORDERS_PER_PHONE, lastDay: 3 })).toContain("لم تُشحن");
    expect(phoneOrderBlock({ open: 0, lastDay: MAX_ORDERS_PER_PHONE_DAY })).toContain("التواصل مع المتجر");
  });
});
