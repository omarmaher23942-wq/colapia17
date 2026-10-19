import { describe, expect, it } from "vitest";
import { normalizeMailDomain, parseFrom, resolveSender, senderDomain } from "@/lib/email-sender";
import { parseListObjects } from "@/lib/storage-list";
import { countdownParts } from "@/lib/trial-countdown";
import { dashboardLock, lockAllowsPath } from "@/lib/store-visibility";

describe("عنوان المرسل (السبب الجذري لعدم وصول البريد)", () => {
  it("النطاق الرئيسي يُطبّع، والقيم غير الصالحة تعود للنطاق الافتراضي", () => {
    expect(normalizeMailDomain("https://www.Colapia.com/")).toBe("colapia.com");
    expect(normalizeMailDomain("colapia.com:3000")).toBe("colapia.com");
    expect(normalizeMailDomain("localhost:3000")).toBe("colapia.com");
    expect(normalizeMailDomain(undefined)).toBe("colapia.com");
    expect(normalizeMailDomain("shop.example.eg")).toBe("shop.example.eg");
  });

  it("EMAIL_FROM يُحلَّل بصيغه الملصوقة (تنصيص، مسافات، NAME=)", () => {
    expect(parseFrom('"Colapia <hello@colapia.com>"')).toEqual({ name: "Colapia", address: "hello@colapia.com" });
    expect(parseFrom("EMAIL_FROM=Team <Team@Colapia.com> ")).toEqual({ name: "Team", address: "team@colapia.com" });
    expect(parseFrom("hello@colapia.com")).toEqual({ name: null, address: "hello@colapia.com" });
    expect(parseFrom("not an email")).toEqual({ name: null, address: null });
  });

  it("لا يُرسل أبداً من نطاق غير الموثّق (resend.dev أو Gmail)، ويُقبل نطاق فرعي موثّق", () => {
    expect(senderDomain("colapia.com", "Colapia <onboarding@resend.dev>")).toBe("colapia.com");
    expect(senderDomain("colapia.com", "me@gmail.com")).toBe("colapia.com");
    expect(senderDomain("colapia.com", "Colapia <hello@mail.colapia.com>")).toBe("mail.colapia.com");
    expect(resolveSender({ kind: "hello", rootDomain: "colapia.com", emailFrom: "Colapia <onboarding@resend.dev>" })).toBe("Colapia <hello@colapia.com>");
  });

  it("البادئة واسم العرض", () => {
    expect(resolveSender({ kind: "orders", rootDomain: "colapia.com", emailFrom: "Colapia <hello@colapia.com>", fromName: 'متجر "نور" <x>' })).toBe("متجر نور x <orders@colapia.com>");
    expect(resolveSender({ kind: "custom", rootDomain: "colapia.com", emailFrom: "Support <support@colapia.com>" })).toBe("Support <support@colapia.com>");
    expect(resolveSender({ kind: "noreply", rootDomain: "www.colapia.com" })).toBe("Colapia <noreply@colapia.com>");
  });
});

describe("مساحة المتجر من قائمة الملفات", () => {
  it("يجمع الأحجام والفيديوهات ويستبعد ما يُطلب، ويقرأ رمز الصفحة التالية", () => {
    const xml = `<?xml version="1.0"?><ListBucketResult><IsTruncated>true</IsTruncated>
      <Contents><Key>stores/a/products/1.jpg</Key><Size>1000</Size></Contents>
      <Contents><Key>stores/a/hero/v.mp4</Key><Size>5000</Size></Contents>
      <Contents><Key>stores/a/receipts/r.jpg</Key><Size>700</Size></Contents>
      <NextContinuationToken>abc&amp;1</NextContinuationToken></ListBucketResult>`;
    const p = parseListObjects(xml, (k) => k.includes("/receipts/"));
    expect(p).toEqual({ bytes: 6000, files: 2, videos: 1, videoBytes: 5000, truncated: true, next: "abc&1" });
    expect(parseListObjects("<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>")).toMatchObject({ bytes: 0, truncated: false, next: null });
  });
});

describe("عدّاد التجربة", () => {
  it("يقسم الوقت وينطقه بالعربية", () => {
    const p = countdownParts((2 * 3600 + 5 * 60 + 9) * 1000);
    expect([p.days, p.hours, p.minutes, p.seconds]).toEqual([0, 2, 5, 9]);
    expect(p.spoken).toBe("متبقٍ ساعتان و5 دقائق");
    expect(countdownParts(-5).spoken).toBe("انتهى الوقت");
    expect(countdownParts(90 * 1000).spoken).toBe("متبقٍ دقيقة و30 ثانية");
    expect(countdownParts(3 * 86_400_000).days).toBe(3);
  });
});

describe("قفل اللوحة عند التجميد أو الإيقاف", () => {
  it("المجمّد والمتوقف بعد السماح فقط", () => {
    expect(dashboardLock({ status: "frozen" }, { phase: "none" })).toBe("frozen");
    expect(dashboardLock({ status: "active" }, { phase: "paused" })).toBe("paused");
    expect(dashboardLock({ status: "active" }, { phase: "grace" })).toBeNull();
    expect(dashboardLock({ status: "trial" }, { phase: "none" })).toBeNull();
    expect(dashboardLock({ status: "frozen", deletedAt: new Date() }, { phase: "none" })).toBeNull();
  });
  it("المفتوح أثناء القفل: الاشتراك والاستخدام فقط", () => {
    expect(lockAllowsPath("/dashboard/billing")).toBe(true);
    expect(lockAllowsPath("/dashboard/billing?locked=1")).toBe(true);
    expect(lockAllowsPath("/dashboard/usage")).toBe(true);
    expect(lockAllowsPath("/dashboard")).toBe(false);
    expect(lockAllowsPath("/dashboard/billingx")).toBe(false);
    expect(lockAllowsPath("/dashboard/products")).toBe(false);
  });
});
