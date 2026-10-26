// build-request.ts — «طلب البناء» في مسار V5 (خالص ومختبَر): المجالات الخمسة التي يغطيها الوكيل مع العميل، شروط الفعل build_request،
// البيانات المنظمة التي تُحفظ في طلب المتجر، ورسالة الإغلاق الثابتة. لا دفع ولا رابط حجز هنا: الفريق يجهز المتجر مجاناً ثم يصل
// العميل رابط إعداد، ولا يُدفع شيء إلا بعد أن يعجبه المتجر. الحفظ الفعلي في build-request-store.ts.
import type { Lead } from "./lead";
import type { Offer } from "./offer";

/** علامة المحادثة في ذاكرتها بعد إنشاء طلب البناء (شارة وفلتر في /admin/conversations). */
export const BUILD_REQUEST_FLAG = "build_request";

export const AREAS = ["identity", "products", "look", "selling", "contact"] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LABEL: Record<Area, string> = {
  identity: "النشاط والهوية (اسم البراند وما يبيعونه)",
  products: "المنتجات (أين هي وكيف تصلنا)",
  look: "الشكل (الذوق أو متجر مرجعي أو الشعار)",
  selling: "البيع والتوصيل (الدفع والمحافظات والشحن والمعاينة)",
  contact: "التواصل (واتساب أو بريد)",
};

/** المجالات التي يجوز للعميل أن يرفض الإجابة عنها (الهوية لا: اسم البراند شرط لأي طلب). */
export const DECLINABLE: readonly Area[] = ["products", "look", "selling", "contact"];

/** هل غُطي المجال بمعلومة فعلية من العميل؟ */
export function areaCovered(area: Area, lead: Lead): boolean {
  switch (area) {
    case "identity":
      return Boolean(lead.storeName);
    case "products":
      return Boolean(lead.products);
    case "look":
      return Boolean(lead.styleNotes);
    case "selling":
      return Boolean(lead.selling);
    case "contact":
      return Boolean(lead.whatsapp || lead.email);
  }
}

/** يقرأ قائمة المجالات المرفوضة من اقتراح النموذج: المسموح رفضها فقط وبلا تكرار. */
export function parseDeclined(raw: unknown): Area[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<Area>();
  for (const v of raw) if (typeof v === "string" && (DECLINABLE as readonly string[]).includes(v)) out.add(v as Area);
  return [...out];
}

/** المجالات التي لم تُغطَّ ولم يرفضها العميل بعد. */
export function openAreas(lead: Lead, declined: readonly Area[]): Area[] {
  return AREAS.filter((a) => !areaCovered(a, lead) && !declined.includes(a));
}

export type BuildCtx = {
  lead: Lead;
  declined: readonly Area[];
  /** المحادثة مصنفة «خدمة أخرى». */
  otherService: boolean;
  /** أُنشئ طلب بناء لهذه المحادثة من قبل. */
  alreadyRequested: boolean;
};

export type BuildCheck = { ok: true } | { ok: false; reason: string };

/** شروط الفعل build_request: اسم البراند، وكل مجال مغطى أو مرفوض صراحة، ولا طلب مكرر ولا خدمة أخرى. */
export function checkBuildRequest(c: BuildCtx): BuildCheck {
  if (c.otherService) return { ok: false, reason: "المحادثة مصنفة خدمة أخرى فلا يُنشأ طلب بناء متجر" };
  if (c.alreadyRequested) return { ok: false, reason: "طلب البناء أُنشئ لهذه المحادثة من قبل" };
  const open = openAreas(c.lead, c.declined);
  if (open.length) return { ok: false, reason: `لم تُغطَّ بعد: ${open.map((a) => AREA_LABEL[a]).join("، ")} (اسألهم بطبيعية، أو سجّل رفضهم في declined إن رفضوا صراحة)` };
  return { ok: true };
}

export type BuildData = {
  v: 5;
  channel: "chat";
  offer: "golden" | "regular";
  identity: { storeName: string; niche: string | null; instagram: string | null };
  products: { text: string | null; declined: boolean };
  look: { text: string | null; declined: boolean };
  selling: { text: string | null; declined: boolean };
  contact: { whatsapp: string | null; email: string | null; declined: boolean };
  /** ملخص الوكيل لما دار في المحادثة وما لم يُقل (ملاحظات حرة للفريق). */
  notes: string;
};

/** إجابات العميل المنظمة كما تُخزَّن في `store_requests.data`. */
export function buildRequestData(i: { lead: Lead; declined: readonly Area[]; offer: Pick<Offer, "golden">; notes: string }): BuildData {
  const { lead, declined } = i;
  return {
    v: 5,
    channel: "chat",
    offer: i.offer.golden ? "golden" : "regular",
    identity: { storeName: lead.storeName ?? "", niche: lead.niche ?? null, instagram: lead.instagram ?? null },
    products: { text: lead.products ?? null, declined: declined.includes("products") && !lead.products },
    look: { text: lead.styleNotes ?? null, declined: declined.includes("look") && !lead.styleNotes },
    selling: { text: lead.selling ?? null, declined: declined.includes("selling") && !lead.selling },
    contact: { whatsapp: lead.whatsapp ?? null, email: lead.email ?? null, declined: declined.includes("contact") && !lead.whatsapp && !lead.email },
    notes: i.notes.replace(/\s+/g, " ").trim().slice(0, 900),
  };
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** «مقعد واحد»، «مقعدان»، «5 مقاعد»، «12 مقعداً». */
export function seatsPhrase(n: number): string {
  const k = Math.max(0, Math.floor(n));
  if (k === 1) return "مقعد واحد";
  if (k === 2) return "مقعدان";
  if (k <= 10) return `${k} مقاعد`;
  return `${k} مقعداً`;
}

/** مدة وعد رابط الإعداد: «6 ساعات»، «24 ساعة»، «يومين»، «3 أيام». */
export function windowPhrase(hours: number): string {
  const h = Math.max(1, Math.round(hours));
  if (h >= 48 && h % 24 === 0) {
    const d = h / 24;
    return d === 2 ? "يومين" : d <= 10 ? `${d} أيام` : `${d} يوماً`;
  }
  if (h === 1) return "ساعة";
  if (h === 2) return "ساعتين";
  return h <= 10 ? `${h} ساعات` : `${h} ساعة`;
}

/** سطر التسعير الصادق عند الإغلاق: السعر بعد الإعجاب فقط، والعدّاد الحقيقي للذهبية. */
export function priceLine(o: Pick<Offer, "golden" | "seatsLeft" | "seatsTotal" | "price" | "regular">): string {
  const pos = (n: number | null): n is number => typeof n === "number" && n > 0;
  if (o.golden && pos(o.price)) {
    const was = pos(o.regular) && o.regular > o.price ? ` بدلاً من ${fmt(o.regular)} ج` : "";
    return `وإن أعجبكم المتجر فسعر التفعيل ${fmt(o.price)} ج${was} ضمن الدائرة الذهبية لأول ${o.seatsTotal} متاجر، وباقي ${seatsPhrase(o.seatsLeft)} منها الآن.`;
  }
  if (pos(o.regular)) return `وإن أعجبكم المتجر فسعر التفعيل ${fmt(o.regular)} ج.`;
  return "";
}

/** رسالة الإغلاق الثابتة: مقدمة النموذج القصيرة ثم الوعد بكلمات متفق عليها. لا دفع ولا رابط. */
export function buildRequestMessage(intro: string, i: { windowHours: number; offer: Pick<Offer, "golden" | "seatsLeft" | "seatsTotal" | "price" | "regular"> }): string {
  const body = [`الفريق سيجهز لكم متجراً مخصصاً مجاناً، وسيصلكم رابط الإعداد هنا خلال ${windowPhrase(i.windowHours)}. لا دفع إلا إن أعجبكم المتجر.`, priceLine(i.offer)].filter(Boolean).join("\n");
  const head = intro.trim();
  return head ? `${head}\n\n${body}` : body;
}
