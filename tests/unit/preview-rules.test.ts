import { describe, expect, it } from "vitest";
import { decidePreview, type PreviewCounts, type PreviewLimits } from "@/onboarding/preview-rules";

const limits: PreviewLimits = { maxOpen: 2, perIp: 3, perPhone: 2, dailyCap: 80 };
const counts = (p: Partial<PreviewCounts> = {}): PreviewCounts => ({ openForMerchant: 0, ip: 0, phone: 0, today: 0, ...p });

describe("حماية المعاينة المجانية", () => {
  it("تاجر جديد بعدّادات صفرية: مسموح", () => {
    expect(decidePreview(counts(), limits).ok).toBe(true);
  });
  it("تاجر عنده متجران قيد التجربة: ممنوع برسالة تخصه", () => {
    const d = decidePreview(counts({ openForMerchant: 2 }), limits);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe("merchant");
  });
  it("الرقم نفسه مرتين في أسبوع ثم ثالثة: ممنوع", () => {
    expect(decidePreview(counts({ phone: 1 }), limits).ok).toBe(true);
    const d = decidePreview(counts({ phone: 2 }), limits);
    expect(!d.ok && d.reason).toBe("phone");
  });
  it("الـ IP نفسه ثلاث مرات في اليوم: الرابعة ممنوعة", () => {
    expect(decidePreview(counts({ ip: 2 }), limits).ok).toBe(true);
    expect(!decidePreview(counts({ ip: 3 }), limits).ok).toBe(true);
  });
  it("السقف اليومي العام يوقف الجميع", () => {
    const d = decidePreview(counts({ today: 80 }), limits);
    expect(!d.ok && d.reason).toBe("daily");
  });
  it("الأولوية لسبب التاجر ثم الرقم ثم IP ثم السقف", () => {
    const d = decidePreview(counts({ openForMerchant: 2, phone: 5, ip: 9, today: 999 }), limits);
    expect(!d.ok && d.reason).toBe("merchant");
  });
});
