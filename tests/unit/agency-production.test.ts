import { describe, expect, it } from "vitest";
import { can, canSeePage } from "@/agency/roles";
import { canMove, canTickQa, canViewRequest, clientStageFor, overdueHours, QA_ITEMS, qaDone, readQa, slaFrom, DEFAULT_SLA_HOURS, type QaState } from "@/agency/production";
import { handleFromSocial, suggestSlug, toSlug } from "@/agency/slug";
import { branchFor, renderPrompt } from "@/agency/prompt";

const B = "11111111-1111-1111-1111-111111111111";
const R = "22222222-2222-2222-2222-222222222222";
const A = "33333333-3333-3333-3333-333333333333";
const all = (by: "builder" | "reviewer"): QaState => Object.fromEntries(QA_ITEMS.filter((i) => i.by === by).map((i) => [i.key, { by: B, at: "x" }]));

describe("الأدوار", () => {
  it("المالك وحده يدير الفريق والأسعار", () => {
    expect(can("owner", "team.manage")).toBe(true);
    expect(can("admin", "team.manage")).toBe(false);
    expect(can("admin", "pricing")).toBe(false);
    expect(can("admin", "payments.decide")).toBe(true);
  });
  it("المنفّذ والمبيعات لا يصلون للمدفوعات ولا المتاجر", () => {
    for (const r of ["builder", "sales", "reviewer"]) {
      expect(can(r, "payments.decide")).toBe(false);
      expect(can(r, "stores.manage")).toBe(false);
      expect(canSeePage(r, "/admin/payments")).toBe(false);
      expect(canSeePage(r, "/admin")).toBe(false);
    }
    expect(canSeePage("sales", "/admin/conversations")).toBe(true);
    expect(canSeePage("builder", "/admin/requests")).toBe(true);
  });
  it("دور غير معروف بلا صلاحيات", () => {
    expect(can("hacker", "requests.note")).toBe(false);
    expect(can(null, "requests.note")).toBe(false);
  });
});

describe("رؤية الطلب", () => {
  it("المنفّذ يرى المسند إليه فقط", () => {
    expect(canViewRequest({ builderId: B, reviewerId: null }, { id: B, role: "builder" })).toBe(true);
    expect(canViewRequest({ builderId: A, reviewerId: null }, { id: B, role: "builder" })).toBe(false);
    expect(canViewRequest({ builderId: A, reviewerId: null }, { id: R, role: "reviewer" })).toBe(true);
  });
});

describe("انتقالات الإنتاج", () => {
  const base = { production: "assigned" as const, builderId: B, reviewerId: R, qa: {} };
  it("المنفّذ المسند يبدأ، وغيره لا", () => {
    expect(canMove(base, "building", { id: B, role: "builder" }).ok).toBe(true);
    expect(canMove(base, "building", { id: A, role: "builder" }).ok).toBe(false);
    expect(canMove(base, "building", { id: A, role: "admin" }).ok).toBe(true);
  });
  it("لا إرسال للمراجعة قبل بنود المنفّذ", () => {
    const b = { ...base, production: "building" as const };
    expect(canMove(b, "review", { id: B, role: "builder" }).ok).toBe(false);
    expect(canMove({ ...b, qa: all("builder") }, "review", { id: B, role: "builder" }).ok).toBe(true);
  });
  it("الاعتماد للمراجع بعد بنوده، ولا يعتمد أحد عمله", () => {
    const r = { ...base, production: "review" as const, qa: all("builder") };
    expect(canMove(r, "ready", { id: R, role: "reviewer" }).ok).toBe(false);
    const done = { ...r, qa: { ...all("builder"), ...all("reviewer") } };
    expect(canMove(done, "ready", { id: R, role: "reviewer" }).ok).toBe(true);
    expect(canMove(done, "ready", { id: B, role: "builder" }).ok).toBe(false);
    expect(canMove({ ...done, builderId: A }, "ready", { id: A, role: "admin" }).ok).toBe(false);
    expect(canMove({ ...done, reviewerId: null }, "ready", { id: "x", role: "reviewer" }).ok).toBe(true);
  });
  it("الإعادة للبناء تشترط ملاحظة", () => {
    const r = { ...base, production: "review" as const };
    expect(canMove(r, "building", { id: R, role: "reviewer" }, "").ok).toBe(false);
    expect(canMove(r, "building", { id: R, role: "reviewer" }, "الصور مقصوصة").ok).toBe(true);
    expect(canMove(r, "building", { id: B, role: "builder" }, "x").ok).toBe(false);
  });
  it("التسليم لا يتم بنقل يدوي، ولا شيء بعده", () => {
    expect(canMove({ ...base, production: "ready" }, "delivered", { id: A, role: "owner" }).ok).toBe(false);
    expect(canMove({ ...base, production: "delivered" }, "building", { id: A, role: "owner" }, "x").ok).toBe(false);
  });
  it("بنود الفحص: المنفّذ لبنوده والمراجع لبنوده", () => {
    const b = QA_ITEMS.find((i) => i.by === "builder")!;
    const r = QA_ITEMS.find((i) => i.by === "reviewer")!;
    expect(canTickQa(base, b, { id: B, role: "builder" })).toBe(true);
    expect(canTickQa(base, r, { id: B, role: "builder" })).toBe(false);
    expect(canTickQa(base, r, { id: R, role: "reviewer" })).toBe(true);
    expect(canTickQa(base, b, { id: R, role: "reviewer" })).toBe(false);
  });
  it("readQa يتجاهل المفاتيح غير المعروفة والقيم التالفة", () => {
    expect(readQa({ brief: { by: B, at: "t" }, evil: { by: B, at: "t" }, data: "x" })).toEqual({ brief: { by: B, at: "t" } });
    expect(qaDone({}, "builder")).toBe(false);
  });
});

describe("مرحلة العميل", () => {
  it("ترتفع مع الإنتاج ولا تنزل", () => {
    expect(clientStageFor("building", "received")).toBe("design");
    expect(clientStageFor("building", "build")).toBe("build");
    expect(clientStageFor("review", "design")).toBe("review");
    expect(clientStageFor("building", "review")).toBe("review");
    expect(clientStageFor("delivered", "review")).toBe("delivery");
  });
});

describe("المهلة", () => {
  it("تُحسب بالساعات بعد مهلة الحالة", () => {
    const since = new Date("2026-01-01T00:00:00Z");
    expect(overdueHours("new", since, DEFAULT_SLA_HOURS, new Date("2026-01-01T03:00:00Z"))).toBe(0);
    expect(overdueHours("new", since, DEFAULT_SLA_HOURS, new Date("2026-01-01T07:30:00Z"))).toBe(3);
    expect(overdueHours("delivered", since, DEFAULT_SLA_HOURS)).toBe(0);
  });
  it("slaFrom يقبل القيم المعقولة فقط", () => {
    expect(slaFrom({ sla: { new: 2, building: 9999, review: "x" } })).toEqual({ ...DEFAULT_SLA_HOURS, new: 2 });
  });
});

describe("النطاق المقترح", () => {
  it("من اسم الحساب أولاً، ثم نقحرة الاسم العربي، ثم الكود", () => {
    expect(handleFromSocial("https://www.instagram.com/nour.store/")).toBe("nour.store");
    expect(handleFromSocial("https://www.instagram.com/p/abc/")).toBeNull();
    expect(suggestSlug({ storeName: "متجر نور", socialUrl: "https://www.instagram.com/Nour.Store/", code: "REQ-1234" })).toBe("nour-store");
    expect(suggestSlug({ storeName: "متجر نور", code: "REQ-1234" })).toBe("mtgr-nor");
    expect(suggestSlug({ storeName: "؟؟", code: "REQ-98765" })).toBe("store-98765");
    expect(toSlug("Dr. Sara's Kitchen")).toBe("dr-sara-s-kitchen");
  });
  it("يتجنب المحجوز والمأخوذ", () => {
    expect(suggestSlug({ storeName: "admin", code: "REQ-1" })).toBe("store-1");
    expect(suggestSlug({ storeName: "nova", code: "REQ-1" }, (s) => s === "nova")).toBe("nova-2");
  });
});

describe("البرومبت", () => {
  const base = { slug: "nova", code: "REQ-1", storeName: "نوفا", brief: "# Brief", provisioned: false, branch: branchFor("nova", 1), teamNotes: [], reviewerNote: null };
  it("بناء جديد: مهارة build-store والفرع والـ brief مضمَّن", () => {
    const p = renderPrompt(base);
    expect(p).toContain("build-store");
    expect(p).toContain("build/nova-1");
    expect(p).toContain("stores/CLAUDE.md");
    expect(p).toContain("# Brief");
    expect(p).not.toMatch(/main\b.*ادفع/);
  });
  it("بعد التجهيز لا يُضمَّن الـ brief، والإعادة تحمل ملاحظات المراجع", () => {
    const p = renderPrompt({ ...base, provisioned: true, reviewerNote: "كبّر الصور", branch: branchFor("nova", 2) });
    expect(p).not.toContain("# Brief");
    expect(p).toContain("كبّر الصور");
    expect(p).toContain("build/nova-2");
  });
});

import { buildDraft, parseProductLine, storeFolderFiles } from "@/agency/draft";
import { emptyIntake } from "@/intake/schema";
import { blueprintSchema } from "@/blueprint/schema";

describe("تحليل كلام التاجر عن المنتج", () => {
  it("الأسلوب القديم بفواصل: الاسم والألوان والمقاسات والسعر", () => {
    expect(parseProductLine("تيشيرت قطن، أسود/أبيض، M L XL، 350")).toEqual({ name: "تيشيرت قطن", price: 350, options: { اللون: ["أسود", "أبيض"], المقاس: ["M", "L", "XL"] } });
  });
  it("أرقام هندية وكلمة جنيه", () => {
    expect(parseProductLine("طقم صيفي، ٤٢٠ جنيه").price).toBe(420);
    expect(parseProductLine("ساعة، 1,250 ج").price).toBe(1250);
  });
  it("بلا سعر = null، والباقي وصف", () => {
    const p = parseProductLine("بيجامة قطن، مريحة للصيف");
    expect(p.price).toBeNull();
    expect(p.note).toBe("مريحة للصيف");
  });
  it("نص حر في جملة واحدة: علامات السعر والمقاس واللون", () => {
    expect(parseProductLine("تيشيرت قطن أسود وأبيض مقاسات M L XL السعر 350 جنيه")).toEqual({
      name: "تيشيرت قطن",
      price: 350,
      options: { المقاس: ["M", "L", "XL"], اللون: ["أسود", "أبيض"] },
    });
    const dress = parseProductLine("فستان سواريه\nاللون: أزرق\nالمقاس: S, M, L\n850 ج");
    expect(dress.name).toBe("فستان سواريه");
    expect(dress.price).toBe(850);
    expect(dress.options).toEqual({ المقاس: ["S", "M", "L"], اللون: ["أزرق"] });
  });
  it("رقم وحيد بلا علامة = سعر، وأرقام المقاسات (حذاء) ليست سعراً", () => {
    expect(parseProductLine("جاكيت جلد ٤٥٠").price).toBe(450);
    expect(parseProductLine("حذاء رياضي مقاسات 40 41 42 السعر 600").price).toBe(600);
    expect(parseProductLine("حذاء رياضي 40 41 42 43").price).toBeNull();
    expect(parseProductLine("حقيبة بسعر1200").price).toBe(1200);
    expect(parseProductLine("كتاب 5 أجزاء").price).toBeNull();
  });
  it("اسم قصير حتى لو الكلام طويل، وكل الكلام لا يضيع", () => {
    const p = parseProductLine("هودي شتوي ثقيل جداً ومناسب للبرد القارس ومبطن من الداخل بفرو ناعم ومريح للغاية ويدوم سنوات طويلة بسعر 700");
    expect(p.price).toBe(700);
    expect(p.name.split(" ").length).toBeLessThanOrEqual(8);
  });
});

describe("المسودة الأولى", () => {
  it("المسعّر في seed، وبلا سعر في أسئلة DELIVERY.md", () => {
    const d = emptyIntake();
    d.store.name = "بيبي كوتون";
    d.colors = { mode: "preset", preset: "soft-rose" };
    d.payment = { methods: ["wallet"], walletNumber: "01112223334" };
    d.products = { items: [{ id: "a", text: "بيجامة، 350", images: ["k1"] }, { id: "b", text: "طقم بلا سعر", images: [] }] };
    const draft = buildDraft({ slug: "baby", code: "REQ-1", data: d, imageUrl: (k) => (k ? `https://media.colapia.com/${k}.jpg` : null) });
    expect(draft.seed.products.map((p) => p.name)).toEqual(["بيجامة"]);
    expect(draft.seed.products[0]!.images).toEqual(["https://media.colapia.com/k1.jpg"]);
    expect(draft.blueprint.payments.vodafoneCash).toMatchObject({ enabled: true, number: "01112223334" });
    expect(draft.missingPrice).toEqual(["طقم بلا سعر"]);
    expect(draft.blueprint.brand.name).toBe("بيبي كوتون");
    expect(draft.blueprint.payments.cod.enabled).toBe(false);
    expect(blueprintSchema.safeParse(draft.blueprint).success).toBe(true);
    const files = storeFolderFiles({ slug: "baby", code: "REQ-1", name: "بيبي كوتون", brief: "# B", draft, assets: [] });
    expect(Object.keys(files)).toContain("stores/baby/blueprint.json");
    expect(files["stores/baby/DELIVERY.md"]).toContain("طقم بلا سعر");
    expect(JSON.parse(files["stores/baby/store.json"]!)).toEqual({ slug: "baby", name: "بيبي كوتون" });
  });
});
