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
  MAX_PRODUCT_IMAGES,
  PRODUCT_TEXT_MAX,
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
/** استمارة عادية صالحة للإرسال بأقل ما يلزم: اسم، تواصل، منتج بنص، دفع عند الاستلام بإجابة المعاينة، توصيل بسعر موحد. */
const valid = (patch: (d: IntakeData) => void = () => {}): IntakeData =>
  make((d) => {
    d.store.name = "متجر نور";
    d.contact.whatsapp = "01012345678";
    d.products.items = [{ id: "a", text: "تيشيرت قطن أسود 350", images: [] }];
    d.payment = { methods: ["cod"], inspection: "yes" };
    d.delivery = { scope: "all", fee: "flat", feeAmount: 60 };
    patch(d);
  });

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
    expect(intakeDataSchema.safeParse({ notes: "x".repeat(8001) }).success).toBe(false);
    // أكثر من الحد في طلب قديم يُقصّ بدل أن يفشل قراءته؛ والصور محدودة بعشر لكل منتج.
    const items = Array.from({ length: MAX_PRODUCTS + 3 }, (_, i) => ({ id: String(i), text: "a" }));
    expect(intakeDataSchema.parse({ products: { items } }).products.items).toHaveLength(MAX_PRODUCTS);
    const eleven = Array.from({ length: MAX_PRODUCT_IMAGES + 1 }, (_, i) => `${KEY}${i}`);
    expect(intakeDataSchema.safeParse({ products: { items: [{ id: "a", text: "x", images: eleven }] } }).success).toBe(false);
    expect(intakeDataSchema.safeParse({ products: { items: [{ id: "a", text: "x".repeat(PRODUCT_TEXT_MAX + 1) }] } }).success).toBe(false);
    expect(intakeDataSchema.safeParse({ logo: { key: "../../etc/passwd" } }).success).toBe(false);
    expect(intakeDataSchema.safeParse({ logo: { key: "https://evil.example/x.png" } }).success).toBe(false);
    expect(intakeDataSchema.safeParse({ colors: { custom: "red" } }).success).toBe(false);
    expect(intakeDataSchema.safeParse({ payment: { methods: ["bitcoin"] } }).success).toBe(false);
  });

  it("الإرسال يحتاج اسم المتجر ووسيلة تواصل واحدة، ومنتجاً ودفعاً وتوصيلاً", () => {
    expect(validateSubmission(emptyIntake())).toMatchObject({
      "store.name": expect.any(String),
      "contact.whatsapp": expect.any(String),
      products: expect.any(String),
      "payment.methods": expect.any(String),
      "delivery.scope": expect.any(String),
      "delivery.fee": expect.any(String),
    });
    expect(validateSubmission(valid())).toEqual({});
    expect(validateSubmission(valid((d) => ((d.contact.whatsapp = undefined), (d.contact.email = "Noor@Example.com"))))).toEqual({});
    expect(validateSubmission(valid((d) => (d.contact.whatsapp = "٠١٠١٢٣٤٥٦٧٨")))).toEqual({});
  });

  it("المنتج يلزمه نص، وصوره اختيارية، والبطاقة الفارغة تُتجاهل", () => {
    expect(validateSubmission(valid((d) => (d.products.items = [{ id: "a", text: "جاكيت", images: [] }])))).toEqual({});
    // صور بلا كلام: خطأ في مكانه
    const e = validateSubmission(valid((d) => (d.products.items = [{ id: "a", text: "جاكيت", images: [] }, { id: "b", text: "  ", images: [`${KEY}1`] }])));
    expect(e["products.b"]).toBeDefined();
    expect(e["products.a"]).toBeUndefined();
    // بطاقة فارغة تماماً بجانب منتج صحيح: لا خطأ، وتُحذف عند التطبيع
    const withBlank = valid((d) => d.products.items.push({ id: "z", text: "", images: [] }));
    expect(validateSubmission(withBlank)).toEqual({});
    expect(normalizeIntake(withBlank).products.items.map((p) => p.id)).toEqual(["a"]);
    // لا منتجات نصية = خطأ المنتجات
    expect(validateSubmission(valid((d) => (d.products.items = [{ id: "z", text: "", images: [] }]))).products).toBeDefined();
  });

  it("الدفع: كل وسيلة تُطلب تفاصيلها (رقم المحفظة، إنستاباي، المعاينة عند الاستلام)", () => {
    const pay = (methods: IntakeData["payment"]["methods"], extra: Partial<IntakeData["payment"]> = {}) => validateSubmission(valid((d) => (d.payment = { methods, ...extra })));
    expect(pay([])["payment.methods"]).toBeDefined();
    expect(pay(["wallet"])["payment.walletNumber"]).toBeDefined();
    expect(pay(["wallet"], { walletNumber: "123" })["payment.walletNumber"]).toContain("غير صحيح");
    expect(pay(["wallet"], { walletNumber: "٠١٠١٢٣٤٥٦٧٨" })).toEqual({});
    expect(pay(["instapay"])["payment.instapayAddress"]).toBeDefined();
    expect(pay(["instapay"], { instapayAddress: "noor@instapay" })).toEqual({});
    expect(pay(["instapay"], { instapayAddress: "نور محمد" })).toEqual({});
    expect(pay(["cod"])["payment.inspection"]).toBeDefined();
    expect(pay(["cod"], { inspection: "no" })).toEqual({});
    // تفاصيل وسيلة غير مختارة لا تُطلب
    expect(pay(["cod"], { inspection: "yes" })).toEqual({});
    expect(pay(["wallet", "instapay", "cod"], { walletNumber: "01012345678", instapayAddress: "x@instapay", inspection: "yes" })).toEqual({});
  });

  it("الشحن: النطاق (والمحافظات) وسعر الشحن (والمبلغ إن كان موحداً)", () => {
    const ship = (delivery: IntakeData["delivery"]) => validateSubmission(valid((d) => (d.delivery = delivery)));
    expect(ship({})).toMatchObject({ "delivery.scope": expect.any(String), "delivery.fee": expect.any(String) });
    expect(ship({ scope: "custom", fee: "free" })["delivery.note"]).toBeDefined();
    expect(ship({ scope: "custom", note: "القاهرة والجيزة", fee: "free" })).toEqual({});
    expect(ship({ scope: "all", fee: "flat" })["delivery.feeAmount"]).toBeDefined();
    expect(ship({ scope: "cairo_giza", fee: "varies" })).toEqual({});
    // قيمة قديمة «لسه مش محدد» لا تُقبل جواباً جديداً
    expect(ship({ scope: "unsure", fee: "free" })["delivery.scope"]).toBeDefined();
  });

  it("الاستبدال اختياري، لكن المدة تلزم متى قال استبدال", () => {
    expect(validateSubmission(valid((d) => (d.returns = { mode: "full" }))) ["returns.days"]).toBeDefined();
    expect(validateSubmission(valid((d) => (d.returns = { mode: "full", days: 14 })))).toEqual({});
    expect(validateSubmission(valid((d) => (d.returns = { mode: "none" })))).toEqual({});
  });

  it("طلب قديم بصيغة {key, line} يُقرأ كمنتج بنص وصورة، ولا يبقى فيه حقل الصوت أو «الفريق يجمع»", () => {
    const d = intakeDataSchema.parse({ social: { url: "@a", teamCollects: true }, voice: { key: KEY }, products: { mode: "team", items: [{ id: "a", key: `${KEY}1`, line: "تيشيرت 350" }, { id: "b", line: "جاكيت" }] } });
    expect(d.products.items).toEqual([
      { id: "a", text: "تيشيرت 350", images: [`${KEY}1`] },
      { id: "b", text: "جاكيت", images: [] },
    ]);
    expect(JSON.stringify(d)).not.toMatch(/voice|teamCollects|"mode":"team"/);
  });

  it("وسيلة تواصل مكتوبة غلط ترفض الإرسال برسالة في مكانها", () => {
    const e = validateSubmission(make((d) => ((d.store.name = "نور"), (d.contact.whatsapp = "0123"), (d.contact.email = "x@"))));
    expect(e["contact.whatsapp"]).toContain("غير صحيح");
    expect(e["contact.email"]).toBeDefined();
  });

  it("«من الشعار» يحتاج شعاراً", () => {
    expect(validateSubmission(valid((d) => (d.colors.mode = "logo")))["colors.mode"]).toBeDefined();
    expect(validateSubmission(valid((d) => ((d.colors.mode = "logo"), (d.logo.key = KEY))))).toEqual({});
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
        d.products.items = [{ id: "a", text: "  ", images: [] }, { id: "b", text: "تيشيرت   قطن 350\n\n\n\nأسود", images: [`${KEY}1`, `${KEY}1`] }];
      }),
    );
    expect(n.store.name).toBe("متجر نور");
    expect(n.contact.email).toBe("noor@example.com");
    expect(n.contact.whatsapp).toBe("01012345678");
    expect(n.products.items).toEqual([{ id: "b", text: "تيشيرت قطن 350\n\nأسود", images: [`${KEY}1`] }]);
    expect(normalizeEmail("bad")).toBeNull();
  });

  it("مفاتيح الملفات المذكورة ونسبة الاكتمال", () => {
    const d = valid((x) => {
      x.logo.key = KEY;
      x.products.items = [{ id: "1", text: "x", images: [`${KEY}1`, `${KEY}2`] }, { id: "2", text: "y", images: [`${KEY}2`] }];
    });
    expect(referencedKeys(d)).toEqual({ images: [`${KEY}1`, `${KEY}2`], logo: KEY });
    expect(completion(emptyIntake())).toBe(0);
    expect(completion(d)).toBeGreaterThan(0.4);
    expect(completion(d)).toBeLessThan(1);
    // كل الأسئلة مُجابة = 1
    const all = valid((x) => {
      x.social.url = "@noor";
      x.colors = { mode: "team" };
      x.logo = { team: true };
      x.returns = { mode: "none" };
      x.inspiration = { team: true };
    });
    expect(completion(all)).toBe(1);
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
    expect(decideIntake({ ...zero, ip24h: DEFAULT_INTAKE_LIMITS.perIp })).toMatchObject({ reason: "ip" });
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
      x.colors.mode = "preset";
      x.colors.preset = "soft-rose";
      x.logo.key = KEY;
      x.products.items = [
        { id: "1", text: "- تيشيرت أسود M L 350\n## قطن مصري", images: [`${KEY}1`, "forgedKey12345", `${KEY}2`] },
        { id: "2", text: "بلا صورة مسجلة", images: [] },
      ];
      x.payment = { methods: ["cod", "wallet", "instapay"], walletNumber: "01112223334", instapayAddress: "noor@instapay", inspection: "no" };
      x.delivery = { scope: "custom", note: "القاهرة والإسكندرية", fee: "flat", feeAmount: 60, eta: "من 2 إلى 4 أيام" };
      x.returns = { mode: "full", days: 14 };
      x.notes = "عايزه بسيط\n## مش عنوان";
    });
    const md = renderBrief({
      code: "REQ-ABCDE",
      data: d,
      assets: [
        { key: KEY, url: "https://utfs.io/f/logo", kind: "logo" },
        { key: `${KEY}1`, url: "https://utfs.io/f/p1", kind: "image" },
        { key: `${KEY}2`, url: "https://utfs.io/f/p2", kind: "image" },
      ],
      submittedAt: new Date("2026-10-11T10:00:00Z"),
    });
    for (const h of ["## المتجر", "## التواصل", "## الهوية", "## السياسات", "## المنتجات (2)", "## طلب العميل بحرية", "## ملاحظات المالك والفريق"]) expect(md).toContain(h);
    expect(md).toContain("# Brief — متجر نور");
    expect(md).toContain("https://www.instagram.com/noor.wear/");
    expect(md).toContain("وردي ناعم");
    // المنتج: نصه كما كتبه (بلا عناوين Markdown مزروعة) وصوره المسجلة فقط
    expect(md).toContain("1. تيشيرت أسود M L 350");
    expect(md).toContain("صور (2): https://utfs.io/f/p1 https://utfs.io/f/p2");
    expect(md).toContain("2. بلا صورة مسجلة");
    expect(md).not.toContain("forgedKey12345");
    expect(md).not.toMatch(/^## قطن مصري/m);
    // الدفع والشحن والاستبدال بتفاصيلها
    expect(md).toContain("فودافون كاش / محافظ: الرقم 01112223334");
    expect(md).toContain("إنستاباي: noor@instapay");
    expect(md).toContain("المعاينة وفتح الشحنة **غير متاحين**");
    expect(md).toContain("محافظات معينة (القاهرة والإسكندرية) · سعر موحّد 60 جنيه · مدة التوصيل: من 2 إلى 4 أيام");
    expect(md).toContain("استبدال واسترجاع خلال 14 يوماً");
    expect(md).not.toMatch(/صوت|تفريغ|يجمع/);
    expect(md).not.toMatch(/^## مش عنوان/m);
    expect(md).toContain("> مش عنوان");
  });
});

import { optionalEmail, optionalWhatsapp } from "@/lib/env";

describe("متغيرات بيئة اختيارية لا توقف التطبيق", () => {
  it("واتساب الوكالة: كل صيغ الكتابة الشائعة تُطبَّع، وغير الصالح يصير غير مضبوط بلا رمي", () => {
    for (const v of ["01012345678", "+201012345678", "010 1234 5678", "201012345678", "00201012345678", "1012345678"]) {
      expect(optionalWhatsapp.parse(v), v).toBe("01012345678");
    }
    for (const v of ["", " ", "abc", "0123", undefined, null, 42]) expect(optionalWhatsapp.parse(v), String(v)).toBeUndefined();
  });

  it("بريد الرد: يقبل «الاسم <بريد>» والمسافات، وغير الصالح يصير غير مضبوط", () => {
    expect(optionalEmail.parse("hi@colapia.com")).toBe("hi@colapia.com");
    expect(optionalEmail.parse(" Hi@Colapia.com ")).toBe("hi@colapia.com");
    expect(optionalEmail.parse("Colapia <hi@colapia.com>")).toBe("hi@colapia.com");
    for (const v of ["", "not an email", "a@b", undefined]) expect(optionalEmail.parse(v), String(v)).toBeUndefined();
  });
});
