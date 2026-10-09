import { describe, expect, it } from "vitest";
import { amountToCollect, collectNote, messageKindFor, orderMessage, shippingLabelText, type MessageOrder } from "@/lib/order-messages";

const order: MessageOrder = {
  code: "CLP-1042",
  customerName: "سارة أحمد علي",
  customerPhone: "01012345678",
  customerAltPhone: "01223334444",
  governorate: "giza",
  city: "الدقي",
  address: "شارع التحرير 5",
  landmark: "أمام البنك",
  totalPiasters: 95_900,
  paymentMethod: "cod",
  paymentStatus: "pending",
  courierName: "بوسطة",
  trackingNumber: "BST-1",
};

describe("collection on delivery", () => {
  it("collects the total for unpaid cash on delivery", () => {
    expect(amountToCollect(order)).toBe(95_900);
    expect(collectNote(order).tone).toBe("warn");
  });

  it("collects nothing once cash on delivery was collected", () => {
    expect(collectNote({ ...order, paymentStatus: "confirmed" }).text).toContain("حُصّل");
  });

  it("never calls an unreviewed transfer 'paid'", () => {
    const n = collectNote({ ...order, paymentMethod: "instapay", paymentStatus: "under_review" });
    expect(n.text).toContain("بانتظار تأكيدك");
    expect(n.text).not.toContain("مدفوع");
  });

  it("warns not to ship when the transfer was rejected", () => {
    expect(collectNote({ ...order, paymentMethod: "vodafone_cash", paymentStatus: "rejected" }).tone).toBe("bad");
  });
});

describe("whatsapp templates", () => {
  it("suggests the message that fits the status", () => {
    expect(messageKindFor("new", "pending")).toBe("confirm");
    expect(messageKindFor("shipped", "pending")).toBe("shipped");
    expect(messageKindFor("new", "rejected")).toBe("payment_rejected");
  });

  it("uses the first name, store name and real order data", () => {
    const m = orderMessage("shipped", order, "نوفا ستايل");
    expect(m).toMatch(/^أهلاً سارة، معك نوفا ستايل\./);
    expect(m).toContain("CLP-1042");
    expect(m).toContain("بوسطة");
    expect(m).toContain("BST-1");
    expect(m).toContain("959 ج.م");
  });

  it("builds a courier-ready shipping label", () => {
    const t = shippingLabelText(order, "نوفا ستايل");
    expect(t).toContain("01012345678 / 01223334444");
    expect(t).toContain("الجيزة — الدقي");
    expect(t).toContain("علامة مميزة: أمام البنك");
    expect(t).toContain("المطلوب تحصيله: 959 ج.م");
  });
});
