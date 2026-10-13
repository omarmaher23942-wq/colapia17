import { describe, expect, it } from "vitest";
import { customScopeUnderstood, governoratesIn, parseEtaDays, paymentsFromIntake, returnsFromIntake, shippingFromIntake, zoneRows } from "@/agency/policies";
import { buildDraft, storeFolderFiles } from "@/agency/draft";
import { blueprintSchema } from "@/blueprint/schema";
import { defaultBlueprint } from "@/blueprint/defaults";
import { emptyIntake, type IntakeData } from "@/intake/schema";

const bp = () => defaultBlueprint({ name: "نور", variationSeed: "t" });

describe("المحافظات من كلام التاجر", () => {
  it("أسماء صريحة بأي إملاء، مع واو لاصقة", () => {
    expect(governoratesIn("القاهرة والجيزة والإسكندرية")).toEqual(["cairo", "giza", "alexandria"]);
    expect(governoratesIn("اسكندرية، المنصورة؟ الدقهلية")).toEqual(["alexandria", "dakahlia"]);
    expect(governoratesIn("بورسعيد و بني سويف")).toEqual(["port_said", "beni_suef"]);
  });
  it("مجموعات: القاهرة الكبرى، الصعيد، الدلتا، سيناء", () => {
    expect(governoratesIn("القاهرة الكبرى")).toEqual(["cairo", "giza", "qalyubia"]);
    expect(governoratesIn("الصعيد")).toEqual(["faiyum", "beni_suef", "minya", "asyut", "sohag", "qena", "luxor", "aswan"]);
    expect(governoratesIn("الدلتا وسيناء")).toEqual(expect.arrayContaining(["gharbia", "north_sinai", "south_sinai"]));
  });
  it("لا شيء مفهوم = قائمة فارغة", () => {
    expect(governoratesIn("")).toEqual([]);
    expect(governoratesIn("أي مكان بنقدر")).toEqual([]);
    expect(customScopeUnderstood({ scope: "custom", note: "أي مكان بنقدر" })).toBe(false);
    expect(customScopeUnderstood({ scope: "custom", note: "الجيزة" })).toBe(true);
    expect(customScopeUnderstood({ scope: "all" })).toBe(true);
  });
});

describe("مدة التوصيل", () => {
  it("نطاق أو يوم محدد أو لا شيء", () => {
    expect(parseEtaDays("من 2 إلى 4 أيام")).toEqual({ min: 2, max: 4 });
    expect(parseEtaDays("٣-٥ أيام")).toEqual({ min: 3, max: 5 });
    expect(parseEtaDays("5 أيام عمل")).toEqual({ min: 5, max: 5 });
    expect(parseEtaDays("يومين")).toEqual({ min: 2, max: 2 });
    expect(parseEtaDays("حسب الطلب")).toBeNull();
    expect(parseEtaDays(undefined)).toBeNull();
  });
});

describe("مناطق الشحن", () => {
  it("كل المحافظات، أو القاهرة والجيزة فقط، أو المذكورة فقط", () => {
    const active = (d: IntakeData["delivery"]) => zoneRows(d).filter((z) => z.isActive).map((z) => z.governorate);
    expect(active({ scope: "all" })).toHaveLength(27);
    expect(active({ scope: "cairo_giza" })).toEqual(["cairo", "giza"]);
    expect(active({ scope: "custom", note: "القاهرة والإسكندرية" })).toEqual(["cairo", "alexandria"]);
    // لم نفهم النص: كلها مفعّلة ويُسأل التاجر
    expect(active({ scope: "custom", note: "حسب الطلب" })).toHaveLength(27);
  });
  it("السعر الموحد والمدة تدخل المناطق", () => {
    const rows = zoneRows({ scope: "all", fee: "flat", feeAmount: 60, eta: "من 2 إلى 4 أيام" });
    expect(rows.every((z) => z.feePiasters === 6000 && z.etaMinDays === 2 && z.etaMaxDays === 4)).toBe(true);
    const varies = zoneRows({ scope: "all", fee: "varies" });
    expect(new Set(varies.map((z) => z.feePiasters)).size).toBeGreaterThan(1);
  });
  it("الشحن في المتجر: موحد، مجاني من أول جنيه، أو يختلف (بلا سعر موحد)", () => {
    const base = bp().shipping;
    expect(shippingFromIntake({ scope: "all", fee: "flat", feeAmount: 75 }, false, base)).toMatchObject({ flatRatePiasters: 7500, freeOverPiasters: null });
    expect(shippingFromIntake({ scope: "all", fee: "free" }, false, base)).toMatchObject({ flatRatePiasters: null, freeOverPiasters: 0 });
    expect(shippingFromIntake({ scope: "all", fee: "varies" }, false, base)).toMatchObject({ flatRatePiasters: null, freeOverPiasters: null });
    expect(shippingFromIntake({ scope: "all", eta: "3 أيام" }, true, base)).toMatchObject({ generalEta: "3 أيام", inspectionAllowed: true });
    expect(shippingFromIntake({ scope: "all" }, false, base).generalEta).toBe(base.generalEta);
  });
});

describe("وسائل الدفع كما قالها التاجر", () => {
  it("المحفظة بالرقم القياسي، وإنستاباي رقماً أو عنواناً أو اسماً، والاستلام بحسب الاختيار", () => {
    const base = bp().payments;
    const p = paymentsFromIntake({ methods: ["wallet", "instapay"], walletNumber: "+20 111 222 3334", instapayAddress: "noor@instapay" }, base);
    expect(p.cod.enabled).toBe(false);
    expect(p.vodafoneCash).toMatchObject({ enabled: true, number: "01112223334" });
    expect(p.instapay).toMatchObject({ enabled: true, address: "noor@instapay" });
    expect(paymentsFromIntake({ methods: ["instapay"], instapayAddress: "01012345678" }, base).instapay).toMatchObject({ enabled: true, number: "01012345678" });
    expect(paymentsFromIntake({ methods: ["instapay"], instapayAddress: "نور محمد" }, base).instapay).toMatchObject({ enabled: true, holderName: "نور محمد" });
    const cod = paymentsFromIntake({ methods: ["cod"], inspection: "yes" }, base);
    expect(cod.cod.enabled).toBe(true);
    expect(cod.vodafoneCash.enabled).toBe(false);
    expect(cod.instapay.enabled).toBe(false);
    // لا وسائل (طلب قديم): الافتراضي كما هو
    expect(paymentsFromIntake({ methods: [] }, base)).toEqual(base);
    expect(blueprintSchema.shape.payments.safeParse(p).success).toBe(true);
  });
  it("لا يُخترع رقم: محفظة بلا رقم تبقى مفعّلة بلا رقم ويُسأل التاجر", () => {
    const p = paymentsFromIntake({ methods: ["wallet"] }, bp().payments);
    expect(p.vodafoneCash.enabled).toBe(true);
    expect(p.vodafoneCash.number).toBeUndefined();
  });
});

describe("الاستبدال والاسترجاع", () => {
  it("ما قاله التاجر فقط، والعيوب والضمان مطفأة", () => {
    const base = bp().returns;
    expect(returnsFromIntake({ mode: "full", days: 14 }, base)).toMatchObject({ windowDays: 14, allowExchange: true, allowRefund: true, defectPolicy: "none" });
    expect(returnsFromIntake({ mode: "exchange", days: 7 }, base)).toMatchObject({ windowDays: 7, allowExchange: true, allowRefund: false });
    expect(returnsFromIntake({ mode: "none" }, base)).toMatchObject({ windowDays: 0, allowExchange: false, allowRefund: false });
    expect(returnsFromIntake({}, base)).toMatchObject({ windowDays: 0, allowExchange: false, allowRefund: false });
    expect(returnsFromIntake({ mode: "full" }, base).allowRefund).toBe(false);
  });
});

describe("المسودة بسياسات التاجر وأسئلة DELIVERY.md", () => {
  const full = (): IntakeData => ({
    ...emptyIntake(),
    store: { name: "نور" },
    contact: { whatsapp: "01012345678" },
    products: { items: [{ id: "a", text: "تيشيرت قطن أسود مقاسات M L السعر 350", images: ["k1", "k2"] }] },
    payment: { methods: ["cod", "wallet"], walletNumber: "01112223334", inspection: "yes" },
    delivery: { scope: "custom", note: "حسب الطلب", fee: "varies", feeNote: "القاهرة 50", eta: "2-4 أيام" },
    returns: { mode: "full", days: 14 },
  });
  it("الـ blueprint صالح وتظهر فيه إجابات التاجر", () => {
    const draft = buildDraft({ slug: "noor", code: "REQ-1", data: full(), imageUrl: (k) => (k ? `https://media.colapia.com/${k}.jpg` : null) });
    expect(blueprintSchema.safeParse(draft.blueprint).success).toBe(true);
    expect(draft.blueprint.payments).toMatchObject({ cod: { enabled: true }, vodafoneCash: { enabled: true, number: "01112223334" }, instapay: { enabled: false } });
    expect(draft.blueprint.shipping).toMatchObject({ inspectionAllowed: true, flatRatePiasters: null, generalEta: "2-4 أيام" });
    expect(draft.blueprint.returns).toMatchObject({ windowDays: 14, allowExchange: true, allowRefund: true });
    expect(draft.seed.products[0]).toMatchObject({ name: "تيشيرت قطن", price: 350, images: ["https://media.colapia.com/k1.jpg", "https://media.colapia.com/k2.jpg"] });
  });
  it("الأسئلة تتضمن ما لم يجب عنه فقط", () => {
    const draft = buildDraft({ slug: "noor", code: "REQ-1", data: full(), imageUrl: () => null });
    const q = draft.questions.join("\n");
    expect(q).toContain("أسعار الشحن لكل محافظة");
    expect(q).toContain("القاهرة 50");
    expect(q).toContain("المحافظات التي يوصّل لها");
    expect(q).toContain("من يتحمل مصاريف شحن المرتجع");
    expect(q).not.toContain("رقم المحفظة");
    expect(q).not.toContain("المعاينة");
    const files = storeFolderFiles({ slug: "noor", code: "REQ-1", name: "نور", brief: "# B", draft, assets: [] });
    expect(files["stores/noor/DELIVERY.md"]).toContain("ضمان العيوب");
    // لم يُجب عن شيء: كل الأسئلة
    const empty = buildDraft({ slug: "x", code: "R", data: { ...emptyIntake(), store: { name: "x" } }, imageUrl: () => null });
    expect(empty.questions.join("\n")).toContain("سعر الشحن لم يُحدَّد");
    expect(empty.questions.join("\n")).toContain("سياسة الاستبدال");
  });
});
