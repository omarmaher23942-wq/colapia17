// faq-from-facts.ts — أسئلة شائعة جاهزة من إعدادات المتجر الفعلية (خالص ومختبَر). لا سؤال بلا إجابة مؤكدة من الإعدادات،
// فلا وعود لم يقدّمها التاجر. تُضاف في قسم «الأسئلة الشائعة» بضغطة.
import type { StoreBlueprint } from "@/blueprint/schema";

export type FaqItem = { q: string; a: string };
const egp = (piasters: number) => `${Math.round(piasters / 100).toLocaleString("en-US")} جنيهاً`;

export function faqFromBlueprint(bp: StoreBlueprint): FaqItem[] {
  const out: FaqItem[] = [];
  const p = bp.payments;
  const methods: string[] = [];
  if (p.cod.enabled) methods.push("الدفع عند الاستلام");
  if (p.vodafoneCash.enabled) methods.push("فودافون كاش");
  if (p.instapay.enabled) methods.push("إنستاباي");
  if (methods.length) out.push({ q: "ما طرق الدفع المتاحة؟", a: `نوفر ${methods.join("، ")}.` });

  const s = bp.shipping;
  const ship: string[] = [];
  if (s.generalEta) ship.push(`مدة التوصيل ${s.generalEta}.`);
  if (s.flatRatePiasters) ship.push(`سعر الشحن ${egp(s.flatRatePiasters)}.`);
  if (s.freeOverPiasters) ship.push(`الشحن مجاني للطلبات من ${egp(s.freeOverPiasters)}.`);
  if (ship.length) out.push({ q: "كم يستغرق التوصيل وما تكلفته؟", a: ship.join(" ") });
  if (s.inspectionAllowed) out.push({ q: "هل يمكن معاينة الطلب عند الاستلام؟", a: "نعم، يمكنكم معاينة الشحنة مع المندوب قبل الدفع." });

  const r = bp.returns;
  if (r.windowDays > 0 && (r.allowExchange || r.allowRefund)) {
    const what = r.allowExchange && r.allowRefund ? "الاستبدال أو الاسترجاع" : r.allowExchange ? "الاستبدال" : "الاسترجاع";
    out.push({ q: "هل يمكن الاستبدال أو الاسترجاع؟", a: `نعم، يتاح ${what} خلال ${r.windowDays} يوماً من الاستلام${r.conditions.length ? `، بشرط: ${r.conditions.slice(0, 3).join("، ")}` : ""}.` });
  } else if (r.windowDays === 0 && !r.allowExchange && !r.allowRefund) {
    out.push({ q: "هل يمكن الاستبدال أو الاسترجاع؟", a: "لا يتاح الاستبدال أو الاسترجاع بعد الاستلام، لذلك راجعوا الطلب جيداً قبل التأكيد." });
  }
  if (r.allowCustomerCancel) out.push({ q: "هل يمكنني إلغاء الطلب؟", a: "نعم، يمكن إلغاء الطلب من صفحة الطلب قبل شحنه." });

  const wa = bp.channels.whatsappNumber;
  if (wa) out.push({ q: "كيف أتواصل مع المتجر؟", a: `راسلونا على واتساب على الرقم ${wa}.` });
  return out.slice(0, 15);
}

/** يدمج الأسئلة الجديدة في قسم الأسئلة الموجود (أو ينشئه قبل الختام)، دون تكرار سؤال موجود. */
export function addFaqToHome(bp: StoreBlueprint, items: FaqItem[]): { bp: StoreBlueprint; added: number } {
  if (!items.length) return { bp, added: 0 };
  const idx = bp.home.findIndex((x) => x.type === "faq");
  if (idx >= 0) {
    const cur = bp.home[idx]!;
    if (cur.type !== "faq") return { bp, added: 0 };
    const have = new Set(cur.items.map((i) => i.q.trim()));
    const fresh = items.filter((i) => !have.has(i.q.trim()));
    const merged = [...cur.items, ...fresh].slice(0, 15);
    const home = bp.home.map((x, i) => (i === idx ? { ...cur, items: merged } : x));
    return { bp: { ...bp, home }, added: merged.length - cur.items.length };
  }
  const id = `faq-${Math.random().toString(36).slice(2, 8)}`;
  const section = { id, type: "faq", variant: "accordion", title: "أسئلة شائعة", enabled: true, items } as unknown as StoreBlueprint["home"][number];
  return { bp: { ...bp, home: [...bp.home, section] }, added: items.length };
}
