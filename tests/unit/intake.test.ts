import { describe, expect, it } from "vitest";
import {
  completion,
  emptyIntake,
  intakeDataSchema,
  normalizeEmail,
  normalizeIntake,
  referencedKeys,
  safeUrl,
  socialUrl,
  validateSubmission,
  MAX_PRODUCTS,
  type IntakeData,
} from "@/intake/schema";
import { canMoveStage, nextStage, stageIndex, STAGE_INFO, REQUEST_STAGES } from "@/intake/stages";
import { estimateEta, etaText, ETA_MAX_HOURS, ETA_MIN_HOURS } from "@/intake/eta";
import { decideIntake, limitsFrom, DEFAULT_INTAKE_LIMITS, INTAKE_MESSAGES } from "@/intake/rules";
import { renderBrief } from "@/intake/brief";

const KEY = "abcDEF123_-xyz789";
const make = (patch: (d: IntakeData) => void): IntakeData => {
  const d = emptyIntake();
  patch(d);
  return d;
};

describe("بيانات الاستمارة", () => {
  it("مسودة فارغة صالحة بقيم افتراضية، والحقول الزائدة تُحذف", () => {
    const d = intakeDataSchema.parse({ junk: 1, store: { name: "نور", hack: true } });
    expect(d.v).toBe(1);
    expect(d.store).toEqual({ name: "نور" });
    expect(d.products.items).toEqual([]);
    expect("junk" in d).toBe(false);
  });

  it("الحدود مفروضة: طول النص وعدد المنتجات وصيغة مفاتيح الملفات والألوان", () => {
    expect(intakeDataSchema.safeParse({ store: { name: "x".repeat(61) } }).success).toBe(false);
    expect(intakeDataSchema.safeParse({ notes: "x".repeat(2001) }).success).toBe(false);
    const items = Array.from({ length: MAX_PRODUCTS + 1 }, (_, i) => ({ id: String(i), line: "a" }));
    expect(intakeDataSchema.safeParse({ products: { items } }).success).toBe(false);
    expect(intakeDataSchema.safeParse({ logo: { key: "../../etc/passwd" } }).success).toBe(false);
    expect(intakeDataSchema.safeParse({ logo: { key: "https://evil.example/x.png" } }).success).toBe(false);
    expect(intakeDataSchema.safeParse({ colors: { custom: "red" } }).success).toBe(false);
    expect(intakeDataSchema.safeParse({ payment: { methods: ["bitcoin"] } }).success).toBe(false);
  });

  it("الإرسال يحتاج اسم المتجر ووسيلة تواصل واحدة فقط", () => {
    expect(validateSubmission(emptyIntake())).toMatchObject({ "store.name": expect.any(String), "contact.whatsapp": expect.any(String) });
    expect(validateSubmission(make((d) => ((d.store.name = "متجر نور"), (d.contact.whatsapp = "01012345678"))))).toEqual({});
    expect(validateSubmission(make((d) => ((d.store.name = "متجر نور"), (d.contact.email = "Noor@Example.com"))))).toEqual({});
    expect(validateSubmission(make((d) => ((d.store.name = "متجر نور"), (d.contact.whatsapp = "٠١٠١٢٣٤٥٦٧٨"))))).toEqual({});
  });

  it("وسيلة تواصل مكتوبة غلط ترفض الإرسال برسالة في مكانها", () => {
    const e = validateSubmission(make((d) => ((d.store.name = "نور"), (d.contact.whatsapp = "0123"), (d.contact.email = "x@"))));
    expect(e["contact.whatsapp"]).toContain("غير صحيح");
    expect(e["contact.email"]).toBeDefined();
  });

  it("«الفريق يجمع منتجاتي» يحتاج رابط الصفحة، و«من الشعار» يحتاج شعاراً", () => {
    const base = (d: IntakeData) => ((d.store.name = "نور"), (d.contact.whatsapp = "01012345678"));
    expect(validateSubmission(make((d) => (base(d), (d.social.teamCollects = true))))["social.url"]).toBeDefined();
    expect(validateSubmission(make((d) => (base(d), (d.colors.mode = "logo"))))["colors.mode"]).toBeDefined();
    expect(validateSubmission(make((d) => (base(d), (d.colors.mode = "logo"), (d.logo.key = KEY))))).toEqual({});
  });

  it("الروابط: https فقط ولا بروتوكولات خطرة، وحساب @اسم يصير إنستجرام", () => {
    expect(safeUrl("example.com/shop")).toBe("https://example.com/shop");
    expect(safeUrl("http://example.com")).toBe("https://example.com/");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,x")).toBeNull();
    expect(safeUrl("https://user:pw@example.com")).toBeNull();
    expect(safeUrl("localhost")).toBeNull();
    expect(socialUrl("@my.store")).toBe("https://www.instagram.com/my.store/");
    expect(socialUrl("mystore")).toBe("https://www.instagram.com/mystore/");
    expect(socialUrl("facebook.com/mystore")).toBe("https://facebook.com/mystore");
    expect(socialUrl("@bad handle!")).toBeNull();
  });

  it("التطبيع: مسافات، بريد بحروف صغيرة، واتساب قياسي، أسطر منتجات فارغة تُحذف", () => {
    const n = normalizeIntake(
      make((d) => {
        d.store.name = "  متجر   نور ";
        d.contact.email = " Noor@Example.COM ";
        d.contact.whatsapp = "+20 101 234 5678";
        d.products.items = [{ id: "a", line: "  " }, { id: "b", line: "تيشيرت قطن 350" }];
      }),
    );
    expect(n.store.name).toBe("متجر نور");
    expect(n.contact.email).toBe("noor@example.com");
    expect(n.contact.whatsapp).toBe("01012345678");
    expect(n.products.items).toEqual([{ id: "b", line: "تيشيرت قطن 350" }]);
    expect(normalizeEmail("bad")).toBeNull();
  });

  it("مفاتيح الملفات المذكورة ونسبة الاكتمال", () => {
    const d = make((x) => {
      x.store.name = "نور";
      x.contact.whatsapp = "01012345678";
      x.logo.key = KEY;
      x.products.items = [{ id: "1", key: `${KEY}1`, line: "x" }, { id: "2", line: "y" }];
      x.voice.key = `${KEY}v`;
    });
    expect(referencedKeys(d)).toEqual({ images: [`${KEY}1`], logo: KEY, voice: `${KEY}v` });
    expect(completion(emptyIntake())).toBe(0);
    expect(completion(d)).toBeGreaterThan(0.4);
    expect(completion(d)).toBeLessThan(1);
  });
});

describe("المراحل", () => {
  it("خمس مراحل بأسماء عربية، والنقل لأي مرحلة أخرى فقط", () => {
    expect(REQUEST_STAGES).toEqual(["received", "design", "build", "review", "delivery"]);
    for (const s of REQUEST_STAGES) expect(STAGE_INFO[s].label.length).toBeGreaterThan(2);
    expect(stageIndex("build")).toBe(2);
    expect(stageIndex(null)).toBe(-1);
    expect(nextStage("review")).toBe("delivery");
    expect(nextStage("delivery")).toBeNull();
    expect(canMoveStage("design", "design")).toBe(false);
    expect(canMoveStage("review", "build")).toBe(true);
    expect(canMoveStage(null, "received")).toBe(true);
    expect(canMoveStage("received", "shipped" as never)).toBe(false);
  });
});

describe("موعد التسليم الصادق", () => {
  it("طابور قصير = من 12 ساعة إلى 4 أيام", () => {
    expect(estimateEta(0)).toEqual({ fromHours: ETA_MIN_HOURS, toHours: ETA_MAX_HOURS, extended: false });
    expect(estimateEta(2, 3)).toEqual({ fromHours: 12, toHours: 96, extended: false });
    expect(etaText(estimateEta(0))).toBe("من 12 ساعة إلى 4 أيام");
  });

  it("طابور طويل يمد النطاق بصدق بدل وعد لا نفي به", () => {
    const e = estimateEta(9, 3);
    expect(e.fromHours).toBe(12 + 3 * 24);
    expect(e.toHours).toBe(e.fromHours + 48);
    expect(e.extended).toBe(true);
    expect(etaText(e)).toBe("من 4 أيام إلى 6 أيام");
  });

  it("قيم غير صالحة لا تكسر الحساب", () => {
    expect(estimateEta(-5, 0)).toEqual(estimateEta(0, 1));
    expect(estimateEta(Number.NaN).fromHours).toBe(12);
  });
});

describe("حماية الاستمارة", () => {
  const zero = { openForContact: 0, email7d: 0, phone7d: 0, ip24h: 0, today: 0 };

  it("بالترتيب: طلب مفتوح ← بريد ← رقم ← شبكة ← سقف يومي", () => {
    expect(decideIntake(zero)).toEqual({ ok: true });
    expect(decideIntake({ ...zero, openForContact: 1, today: 999 })).toMatchObject({ ok: false, reason: "contact" });
    expect(decideIntake({ ...zero, email7d: 2 })).toMatchObject({ reason: "email" });
    expect(decideIntake({ ...zero, phone7d: 2 })).toMatchObject({ reason: "phone" });
    expect(decideIntake({ ...zero, ip24h: 3 })).toMatchObject({ reason: "ip" });
    expect(decideIntake({ ...zero, today: 60 })).toMatchObject({ reason: "daily", message: INTAKE_MESSAGES.daily });
  });

  it("حدود اللوحة تُقبل صالحة فقط", () => {
    expect(limitsFrom(null)).toEqual(DEFAULT_INTAKE_LIMITS);
    expect(limitsFrom({ dailyCap: 10, perIp: -1, perEmail: "x", perPhone: 2.5 })).toEqual({ ...DEFAULT_INTAKE_LIMITS, dailyCap: 10 });
  });
});

describe("الـ brief", () => {
  it("بأقسام قالب المتجر وروابط الملفات من جدول الطلب فقط، ونص العميل لا يكسر Markdown", () => {
    const d = make((x) => {
      x.store.name = "# متجر نور";
      x.store.oneLine = "تيشيرتات قطن";
      x.contact.whatsapp = "01012345678";
      x.social.url = "@noor.wear";
      x.social.teamCollects = true;
      x.colors.mode = "preset";
      x.colors.preset = "soft-rose";
      x.logo.key = KEY;
      x.products.mode = "list";
      x.products.items = [{ id: "1", key: `${KEY}1`, line: "- تيشيرت أسود M L 350" }, { id: "2", key: "forgedKey12345", line: "بلا صورة مسجلة" }];
      x.payment.methods = ["cod", "wallet"];
      x.delivery.scope = "all";
      x.notes = "عايزه بسيط\n## مش عنوان";
    });
    const md = renderBrief({
      code: "REQ-ABCDE",
      data: d,
      assets: [
        { key: KEY, url: "https://utfs.io/f/logo", kind: "logo" },
        { key: `${KEY}1`, url: "https://utfs.io/f/p1", kind: "image" },
      ],
      submittedAt: new Date("2026-10-11T10:00:00Z"),
    });
    for (const h of ["## المتجر", "## التواصل", "## الهوية", "## السياسات", "## المنتجات", "## ملاحظات العميل", "## ملاحظات المالك والفريق"]) expect(md).toContain(h);
    expect(md).toContain("# Brief — متجر نور");
    expect(md).toContain("https://www.instagram.com/noor.wear/");
    expect(md).toContain("☑ الفريق يستخرج المنتجات");
    expect(md).toContain("وردي ناعم");
    expect(md).toContain("1. تيشيرت أسود M L 350 — صورة: https://utfs.io/f/p1");
    expect(md).toContain("2. بلا صورة مسجلة");
    expect(md).not.toContain("forgedKey12345");
    expect(md).toContain("الدفع عند الاستلام، فودافون كاش / محافظ");
    expect(md).not.toMatch(/^## مش عنوان/m);
    expect(md).toContain("> مش عنوان");
  });
});
