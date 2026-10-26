import { describe, expect, it } from "vitest";
import {
  groundLeadInput,
  leadStatus,
  mergeLead,
  parseInstagramHandle,
  validateEmail,
  validateNiche,
  validateStoreName,
  validateStyleNotes,
  validateWhatsapp,
  type Lead,
} from "@/agent/lead";
import { canonicalEmail, maskEmail, normalizeEmail } from "@/lib/contact";

const full: Lead = { niche: "ملابس رجالي", storeName: "نور", email: "a@gmail.com", emailCanonical: "a@gmail.com", whatsapp: "01012345678" };

describe("التحقق من بيانات العميل المحتمل", () => {
  it("اسم المتجر من 2 إلى 60 حرفاً وبحرف أو رقم", () => {
    expect(validateStoreName("نور")).toBe("نور");
    expect(validateStoreName("  Nour   Store ")).toBe("Nour Store");
    expect(validateStoreName("ن")).toBeNull();
    expect(validateStoreName("!!")).toBeNull();
    expect(validateStoreName("ا".repeat(61))).toBeNull();
    expect(validateStoreName(42)).toBeNull();
  });

  it("النشاط من 3 إلى 120 حرفاً", () => {
    expect(validateNiche("ملابس")).toBe("ملابس");
    expect(validateNiche("مم")).toBeNull();
    expect(validateNiche("ا".repeat(121))).toBeNull();
    expect(validateNiche("123")).toBeNull();
  });

  it("البريد: تطبيع وصيغة قانونية (نقاط Gmail ووسوم + وgooglemail)", () => {
    expect(validateEmail(" Omar.Maher+shop@GoogleMail.com ")).toEqual({ email: "omar.maher+shop@googlemail.com", canonical: "omarmaher@gmail.com" });
    expect(validateEmail("ليس بريدا")).toBeNull();
    expect(validateEmail("a@b")).toBeNull();
    expect(canonicalEmail("a.b@yahoo.com")).toBe("a.b@yahoo.com");
    expect(normalizeEmail("x@y.co")).toBe("x@y.co");
  });

  it("واتساب مصري بكل الصيغ", () => {
    expect(validateWhatsapp("+20 101 234 5678")).toBe("01012345678");
    expect(validateWhatsapp("٠١٠١٢٣٤٥٦٧٨")).toBe("01012345678");
    expect(validateWhatsapp("0123")).toBeNull();
    expect(validateWhatsapp(null)).toBeNull();
  });

  it("حساب إنستجرام من @ أو رابط أو اسم، ويرفض المسارات العامة", () => {
    expect(parseInstagramHandle("@Nour.Store")).toBe("nour.store");
    expect(parseInstagramHandle("https://www.instagram.com/nour_store/?hl=ar")).toBe("nour_store");
    expect(parseInstagramHandle("nour_store")).toBe("nour_store");
    expect(parseInstagramHandle("https://instagram.com/p/ABC")).toBeNull();
    expect(parseInstagramHandle("اسم عربي")).toBeNull();
    expect(parseInstagramHandle("a..b")).toBeNull();
  });

  it("المخفي من البريد للعرض", () => {
    expect(maskEmail("omar@gmail.com")).toBe("om***@gmail.com");
    expect(maskEmail("x")).toBe("***");
  });
});

describe("دمج البيانات", () => {
  it("قيمة صالحة تُحفظ، والخاطئة تُسجَّل ولا تمحو القديمة", () => {
    const a = mergeLead({}, { niche: "ملابس", storeName: "نور", email: "bad", whatsapp: "0101" });
    expect(a.lead).toEqual({ niche: "ملابس", storeName: "نور" });
    expect(a.invalid).toEqual({ email: "bad", whatsapp: "0101" });

    const b = mergeLead(a.lead, { email: "A.B@gmail.com", whatsapp: "01012345678" }, { prevInvalid: a.invalid });
    expect(b.lead.email).toBe("a.b@gmail.com");
    expect(b.lead.emailCanonical).toBe("ab@gmail.com");
    expect(b.lead.whatsapp).toBe("01012345678");
    expect(b.invalid).toEqual({});
  });

  it("لا يمحو قيمة محفوظة بفارغ أو خاطئ، ويقبل التصحيح الصالح", () => {
    const start = { ...full };
    const empty = mergeLead(start, { niche: "", storeName: null, email: undefined });
    expect(empty.lead).toEqual(start);
    const wrong = mergeLead(start, { storeName: "x" });
    expect(wrong.lead.storeName).toBe("نور");
    expect(wrong.invalid.storeName).toBe("x");
    const fixed = mergeLead(start, { storeName: "نور ستور" });
    expect(fixed.lead.storeName).toBe("نور ستور");
  });

  it("حساب إنستجرام من الملف الشخصي هو الأوثق", () => {
    const m = mergeLead({}, { instagram: "@somebody_else" }, { profileInstagram: "Real.Handle" });
    expect(m.lead.instagram).toBe("real.handle");
    const messenger = mergeLead({}, { instagram: "@my_brand" });
    expect(messenger.lead.instagram).toBe("my_brand");
  });

  it("لا يقبل بريداً أو رقماً لم يكتبه العميل فعلاً", () => {
    const user = ["عندي براند ملابس", "الايميل omar@gmail.com والرقم ٠١٠١٢٣٤٥٦٧٨"];
    const g = groundLeadInput({ email: "omar@gmail.com", whatsapp: "01012345678", niche: "ملابس" }, user);
    expect(g.email).toBe("omar@gmail.com");
    expect(g.whatsapp).toBe("01012345678");
    const hallucinated = groundLeadInput({ email: "other@gmail.com", whatsapp: "01199999999", niche: "ملابس" }, user);
    expect(hallucinated.email).toBeUndefined();
    expect(hallucinated.whatsapp).toBeUndefined();
    expect(hallucinated.niche).toBe("ملابس");
  });
});

describe("حالة الجمع", () => {
  it("الترتيب ثابت والخاطئ يظهر منفصلاً", () => {
    const s = leadStatus({ storeName: "نور" }, { email: "bad" });
    expect(s.collected).toEqual(["storeName"]);
    expect(s.missing).toEqual(["niche", "instagram", "products", "styleNotes", "selling", "whatsapp", "email"]);
    expect(s.invalid).toEqual(["email"]);
  });

  it("إجابات V5 (المنتجات والبيع) تُحفظ مقصوصة التحقق، وميول التصميم كذلك", () => {
    const m = mergeLead({}, { storeName: "نور", styleNotes: "ألوان ترابية وطابع هادئ", products: "صور على الموبايل", selling: "دفع عند الاستلام والشحن 60 ج", email: "a@gmail.com" });
    expect(m.lead).toMatchObject({ products: "صور على الموبايل", selling: "دفع عند الاستلام والشحن 60 ج", styleNotes: "ألوان ترابية وطابع هادئ" });
    expect(mergeLead({}, { products: ".." }).invalid.products).toBe("..");
    expect(validateStyleNotes("..")).toBeNull();
    expect(validateStyleNotes("س".repeat(301))).toBeNull();
  });
});
