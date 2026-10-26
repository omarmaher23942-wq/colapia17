// setup-recipe.ts — وصفة «إعداد المتجر» المخصصة لكل تاجر (خالصة ومختبَرة، بلا تبعيات خادم).
// تبني قائمة الخطوات من (أ) إجابات طلب البناء (store_requests.data v5)، و(ب) حقائق المتجر الفعلية بعد بناء الفريق له،
// و(ج) تجاوز اختياري يكتبه الفريق في stores/<slug>/setup-recipe.json. لكل خطوة وضع:
//   prefilled = عرفناه فتظهر بتأكيد بضغطة  ·  ask = ينقص منه ما يحتاج إدخالاً  ·  skip = لا داعي له الآن.
// القاعدة: لا يسأل التاجر إلا عما ينقص، ولا يُضاف خيار لم يطلبه (الهدية والتغليف وإلغاء الطلب وكود الخصم لا تظهر هنا أبداً).
import { z } from "zod";
import type { CommerceQuestion, StepId } from "@/lib/onboarding";

export const RECIPE_STEPS: readonly StepId[] = ["identity", "products", "look", "commerce", "publish"];
export const COMMERCE_ASKABLE = ["cod", "inspection", "transfer", "whatsapp", "shipping", "returns"] as const satisfies readonly CommerceQuestion[];
export type CommerceAskable = (typeof COMMERCE_ASKABLE)[number];

export type StepMode = "prefilled" | "ask" | "skip";
export type ProductsMode = "bulk_upload" | "fill_missing" | "confirm";
export type ProductsSource = "phone" | "team" | "file" | "unknown";

/** تجاوز يكتبه الفريق لمتجر بعينه (يُفحص عند توليد السجل وعند القراءة). */
export const setupRecipeOverrideSchema = z
  .object({
    steps: z.record(z.enum(["identity", "products", "look", "commerce", "publish"]), z.enum(["prefilled", "ask", "skip"])).optional(),
    productsMode: z.enum(["bulk_upload", "fill_missing", "confirm"]).optional(),
    commerce: z.object({ ask: z.array(z.enum(COMMERCE_ASKABLE)).optional(), skip: z.array(z.enum(COMMERCE_ASKABLE)).optional() }).strict().optional(),
    note: z.string().trim().max(240).optional(),
  })
  .strict();
export type SetupRecipeOverride = z.infer<typeof setupRecipeOverrideSchema>;

/** ما نقرؤه من إجابات الوكيل (BuildData v5) بتسامح: أي حقل ناقص أو غريب يُعامل كأنه غير مُجاب. */
export type Answers = {
  storeName: string | null;
  productsText: string | null;
  lookText: string | null;
  sellingText: string | null;
  whatsapp: string | null;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function readAnswers(data: unknown): Answers | null {
  const d = obj(data);
  if (d.v !== 5) return null;
  return {
    storeName: str(obj(d.identity).storeName),
    productsText: str(obj(d.products).text),
    lookText: str(obj(d.look).text),
    sellingText: str(obj(d.selling).text),
    whatsapp: str(obj(d.contact).whatsapp),
  };
}

/** مصدر المنتجات من كلام العميل: صور على الهاتف سيرفعها، أو صفحة/ملف يجمعه الفريق. */
export function productsSourceOf(text: string | null): ProductsSource {
  if (!text) return "unknown";
  const t = text.toLowerCase();
  if (/https?:\/\/|www\.|instagram\.com|facebook\.com|@\w{3,}|رابط|صفحة|صفحتنا|حساب/.test(t)) return "team";
  if (/ملف|كتالوج|اكسل|إكسل|excel|pdf|sheet/.test(t)) return "file";
  if (/صور|موبايل|هاتف|جوال|تليفون|ارفع|سأرفع|هرفع|معرض/.test(t)) return "phone";
  return "unknown";
}

/** حقائق المتجر الفعلية بعد أن بناه الفريق (مأخوذة من بياناته لا من الإجابات). */
export type StoreFacts = {
  storeName: string;
  hasLogo: boolean;
  products: { total: number; active: number; drafts: number };
  /** بناء الفريق وضع للمتجر شكلاً مخصصاً (مجلد المتجر أو قالباً/تصميماً مختاراً). */
  lookReady: boolean;
  cod: boolean;
  /** وسيلة تحويل مفعّلة ببياناتها الكاملة. */
  transferReady: boolean;
  /** وسيلة تحويل مفعّلة بلا رقم أو عنوان. */
  transferIncomplete: boolean;
  /** هل حُفظ قرار المعاينة وفتح الشحنة (إجابة صريحة بنعم أو لا) من التاجر أو الفريق. */
  inspectionAnswered: boolean;
  whatsapp: boolean;
  zonesSaved: boolean;
};

export type RecipeStep = { id: StepId; mode: StepMode; reason: string; lines: string[] };

export type Recipe = {
  steps: RecipeStep[];
  productsMode: ProductsMode;
  productsSource: ProductsSource;
  /** أسئلة «الدفع والشحن» التي تحتاج إدخالاً (والباقي مؤكَّد). */
  commerceAsk: CommerceAskable[];
  firstStep: StepId;
  /** تقدير صريح لمدة الإكمال بالثواني. */
  estimatedSeconds: number;
  note: string | null;
};

const SECONDS = { prefilled: 6, askSimple: 25, productsBulk: 70, productsFill: 40, publish: 12 } as const;

export function buildRecipe(i: { answers: Answers | null; facts: StoreFacts; override?: SetupRecipeOverride | null }): Recipe {
  const { answers: a, facts: f } = i;
  const ov = i.override ?? {};
  const source = productsSourceOf(a?.productsText ?? null);

  // ── المنتجات ──
  let productsMode: ProductsMode;
  let productsStep: Pick<RecipeStep, "mode" | "reason" | "lines">;
  if (f.products.total > 0 && f.products.drafts === 0 && f.products.active > 0) {
    productsMode = "confirm";
    productsStep = { mode: "prefilled", reason: "أضافها الفريق", lines: [`${f.products.active} منتج جاهز بصوره وأسعاره`] };
  } else if (f.products.total > 0) {
    productsMode = "fill_missing";
    productsStep = { mode: "ask", reason: "ينقصها الأسعار أو المقاسات", lines: [`${f.products.total} منتجاً أضافها الفريق`, `${f.products.drafts} منها تنتظر سعركم أو تفاصيلكم`] };
  } else {
    productsMode = "bulk_upload";
    productsStep = {
      mode: "ask",
      reason: source === "phone" || source === "unknown" ? "صوركم على الهاتف" : "لم تصل المنتجات بعد",
      lines: ["ارفعوا الصور دفعة واحدة وتُقرأ تفاصيلها معاً"],
    };
  }
  if (ov.productsMode) productsMode = ov.productsMode;

  // ── الدفع والشحن ──
  const ask: CommerceAskable[] = [];
  const paymentKnown = f.cod || f.transferReady;
  if (!paymentKnown && !f.transferIncomplete) ask.push("cod");
  if (f.transferIncomplete) ask.push("transfer");
  if (f.cod && !f.inspectionAnswered) ask.push("inspection");
  if (!f.whatsapp) ask.push("whatsapp");
  if (!f.zonesSaved) ask.push("shipping");
  const commerceAsk = COMMERCE_ASKABLE.filter((q) => (ask.includes(q) || ov.commerce?.ask?.includes(q)) && !ov.commerce?.skip?.includes(q));

  const commerceLines: string[] = [];
  if (f.cod) commerceLines.push("الدفع عند الاستلام");
  if (f.transferReady) commerceLines.push("الدفع بالتحويل");
  if (f.zonesSaved) commerceLines.push("الشحن مضبوط");
  if (f.whatsapp) commerceLines.push("واتساب جاهز");

  const steps: RecipeStep[] = [
    f.storeName && (a?.storeName || f.storeName)
      ? { id: "identity", mode: "prefilled", reason: "من إجاباتكم", lines: [f.storeName, f.hasLogo ? "الشعار مرفوع" : "بلا شعار بعد (اختياري)"] }
      : { id: "identity", mode: "ask", reason: "اسم المتجر مطلوب", lines: [] },
    { id: "products", ...productsStep },
    f.lookReady || a?.lookText
      ? { id: "look", mode: "skip", reason: "صممه الفريق لكم", lines: [] }
      : { id: "look", mode: "ask", reason: "اختاروا شكلاً يعجبكم", lines: [] },
    commerceAsk.length
      ? { id: "commerce", mode: "ask", reason: "ينقص بعض الإجابات", lines: commerceLines }
      : { id: "commerce", mode: "prefilled", reason: "من إجاباتكم", lines: commerceLines },
    { id: "publish", mode: "ask", reason: "مراجعة أخيرة", lines: [] },
  ];

  // تجاوز الفريق على مستوى الخطوة أقوى من الاستنتاج، إلا النشر فلا يُلغى.
  for (const s of steps) {
    const m = ov.steps?.[s.id];
    if (m && s.id !== "publish") s.mode = m;
  }

  const visible = steps.filter((s) => s.mode !== "skip");
  const firstStep = (visible.find((s) => s.mode === "ask") ?? visible[0] ?? steps[steps.length - 1]!).id;

  let seconds = 0;
  for (const s of visible) {
    if (s.id === "publish") seconds += SECONDS.publish;
    else if (s.mode === "prefilled") seconds += SECONDS.prefilled;
    else if (s.id === "products") seconds += productsMode === "bulk_upload" ? SECONDS.productsBulk : SECONDS.productsFill;
    else if (s.id === "commerce") seconds += SECONDS.askSimple * Math.max(1, commerceAsk.length);
    else seconds += SECONDS.askSimple;
  }

  return { steps, productsMode, productsSource: source, commerceAsk, firstStep, estimatedSeconds: seconds, note: ov.note ?? null };
}

/** الخطوات الظاهرة للتاجر بترتيبها. */
export const visibleSteps = (r: Recipe): StepId[] => r.steps.filter((s) => s.mode !== "skip").map((s) => s.id);
export const stepMode = (r: Recipe, id: StepId): StepMode => r.steps.find((s) => s.id === id)?.mode ?? "ask";

/** الخطوة التالية/السابقة ضمن الظاهرة فقط. */
export function neighbour(r: Recipe, from: StepId, dir: 1 | -1): StepId {
  const ids = visibleSteps(r);
  const i = ids.indexOf(from);
  if (i === -1) return r.firstStep;
  return ids[Math.min(ids.length - 1, Math.max(0, i + dir))]!;
}

/** الخطوات المحسوبة منجزة لأن الوصفة تخطتها (تدخل في نسبة التقدم). */
export const skippedSteps = (r: Recipe): StepId[] => r.steps.filter((s) => s.mode === "skip").map((s) => s.id);

/** أسئلة الدفع والشحن التي ستُعرض فعلاً (للمعالج) بترتيبها الثابت. */
export function questionsForWizard(r: Recipe, cod: boolean): CommerceAskable[] {
  return r.commerceAsk.filter((q) => (q === "inspection" ? cod : true));
}
