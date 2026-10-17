// policies.ts — قارئات خالصة لكلام التاجر الحر عن الشحن: المحافظات المذكورة، مدة التوصيل، وأسعار «تختلف حسب المحافظة».
import { GOVERNORATES } from "@/lib/egypt";
import { normalizeArabic } from "@/lib/arabic";
import { normalizeDigits } from "@/lib/phone";

// ─── المحافظات من نص حر ─────────────────────────────────────────────────────

const GROUPS: Record<string, string[]> = {
  "القاهره الكبري": ["cairo", "giza", "qalyubia"],
  الدلتا: GOVERNORATES.filter((g) => g.group === "delta").map((g) => g.code),
  الصعيد: GOVERNORATES.filter((g) => g.group === "upper").map((g) => g.code),
  "مدن القناه": ["port_said", "ismailia", "suez"],
  القناه: ["port_said", "ismailia", "suez"],
  سيناء: ["north_sinai", "south_sinai"],
};

const ALIASES: Record<string, string[]> = {
  alexandria: ["اسكندريه", "الاسكندريه", "اسكندرية"],
  kafr_el_sheikh: ["كفر الشيخ", "كفرالشيخ"],
  port_said: ["بورسعيد", "بور سعيد"],
  beni_suef: ["بني سويف", "بنى سويف", "بني سويف"],
  new_valley: ["الوادي الجديد", "الوادى الجديد"],
  red_sea: ["البحر الاحمر", "الغردقه", "شرم الشيخ"],
  north_sinai: ["شمال سيناء", "العريش"],
  south_sinai: ["جنوب سيناء", "شرم الشيخ"],
};

/** رموز المحافظات المذكورة في نص التاجر («القاهرة والجيزة والإسكندرية»، «الصعيد»، «القاهرة الكبرى»…). */
export function governoratesIn(text: string | undefined | null): string[] {
  const t = normalizeArabic(text ?? "").replace(/[،,؛;/\\|+\-_()[\]{}.؟?!:]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return [];
  // يقبل «و» لاصقة قبل الاسم (والجيزة) و«ال» اختيارية، وحدود كلمة عربية حقيقية.
  const has = (name: string) => new RegExp(`(?:^|\\s)و?(?:${normalizeArabic(name).replace(/^ال/, "(?:ال)?")})(?=\\s|$)`).test(t);
  const found = new Set<string>();
  for (const [name, codes] of Object.entries(GROUPS)) if (has(name)) codes.forEach((c) => found.add(c));
  for (const g of GOVERNORATES) if ([g.name, ...(ALIASES[g.code] ?? [])].some(has)) found.add(g.code);
  return GOVERNORATES.map((g) => g.code).filter((c) => found.has(c));
}

// ─── مدة التوصيل ────────────────────────────────────────────────────────────

/** «من 2 إلى 4 أيام» → {min: 2, max: 4}؛ «يومين» → {2,2}؛ «3 أيام» → {3,3}؛ غير مفهوم → null. */
export function parseEtaDays(text: string | undefined | null): { min: number; max: number } | null {
  const t = normalizeArabic(normalizeDigits(text ?? ""));
  if (!t) return null;
  const nums = [...t.matchAll(/\d{1,2}/g)].map((m) => Number(m[0])).filter((n) => n >= 1 && n <= 30);
  if (nums.length >= 2) return { min: Math.min(nums[0]!, nums[1]!), max: Math.max(nums[0]!, nums[1]!) };
  if (nums.length === 1) return { min: nums[0]!, max: nums[0]! };
  const word = (w: string) => new RegExp(`(?<![\\u0600-\\u06FF])${w}(?![\\u0600-\\u06FF])`).test(t);
  if (word("يومين")) return { min: 2, max: 2 };
  if (word("يوم") || word("يوم واحد") || word("خلال يوم")) return { min: 1, max: 1 };
  return null;
}

// ─── الشحن ──────────────────────────────────────────────────────────────────

export type ZoneRow = { governorate: string; feePiasters: number; codExtraPiasters: number; etaMinDays: number; etaMaxDays: number; isActive: boolean };

// «بقية المحافظات 80»، «الباقي 80»، «باقي الأقاليم 80»، «أي محافظة تانية 80».
const REST_RE = /(?:^|\s)و?(?:ال)?(?:بقيه|باقي|باقيه|اقاليم|محافظات)(?=\s|$)|اي محافظه|غير (?:كده|ذلك)/;
// رقم يليه «يوم/أيام/ساعة» (ولو بعد نطاق «3-5 أيام») مدة توصيل لا سعر.
const DAYS_AFTER = /^\s*(?:(?:-|–|الي|ل|او)\s*\d{1,2}\s*)?(?:يوم|ايام|يومين|ساعه|ساعات)/;

/**
 * أسعار الشحن لكل محافظة من نص «يختلف حسب المحافظة» (بالقروش): «القاهرة والجيزة 60، أسوان والأقصر 120، بقية المحافظات 80»
 * → byGov {cairo, giza: 6000؛ aswan, luxor: 12000} وrest 8000. كل جملة (بين الفواصل) لها سعر، وإن تعدد السعر في جملة
 * فكل سعر لما قبله («القاهرة 60 والجيزة 70»). «مجاناً» بلا رقم = 0. ما لا يُفهم لا يُخمَّن (يبقى السعر الافتراضي ويُسأل التاجر).
 */
export function feesFromNote(note: string | undefined | null): { byGov: Map<string, number>; rest: number | null } {
  const byGov = new Map<string, number>();
  let rest: number | null = null;
  const assign = (text: string, egp: number) => {
    const codes = governoratesIn(text);
    if (codes.length) codes.forEach((c) => byGov.set(c, egp * 100));
    else if (REST_RE.test(text) && rest === null) rest = egp * 100;
  };
  // فاصل الآلاف («1,250») ليس فاصل جمل، والتقسيم قبل normalizeArabic (تدمج الأسطر في مسافة).
  const text = normalizeDigits(note ?? "").replace(/(\d)[,٬](\d{3})(?!\d)/g, "$1$2");
  for (const raw of text.split(/[،,؛;\n]+/)) {
    const seg = normalizeArabic(raw);
    // رقم من 4 خانات فأقل (رقم هاتف في النص ليس سعراً)، وما يليه «يوم/أيام» مدة لا سعر.
    const prices = [...seg.matchAll(/\d+/g)].filter((m) => m[0].length <= 4 && Number(m[0]) <= 5000 && !DAYS_AFTER.test(seg.slice(m.index! + m[0].length)));
    if (!prices.length) {
      if (/مجان|ببلاش/.test(seg)) assign(seg, 0);
    } else if (prices.length === 1) {
      assign(seg, Number(prices[0]![0]));
    } else {
      let from = 0;
      for (const m of prices) {
        assign(seg.slice(from, m.index), Number(m[0]));
        from = m.index! + m[0].length;
      }
    }
  }
  return { byGov, rest };
}
