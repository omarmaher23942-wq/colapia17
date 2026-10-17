// pdp.ts — منطق خالص لصفحة المنتج: ترتيب القيم، الألوان، خصم الكمية، موعد التوصيل، وتحقق سؤال المنتج.
import { colorFromName } from "@/lib/color-names";

type OptionDef = { name: string; kind?: string; values: { label: string; hex?: string }[] };

const SIZE_ORDER = ["xxs", "xs", "s", "m", "l", "xl", "xxl", "2xl", "xxxl", "3xl", "4xl", "5xl", "free", "one size", "حر", "فري"];

/** ترتيب مقاس: الأرقام تصاعدياً، ثم الحروف على سلم S<M<L<XL، وغير المعروف في آخرها بترتيبه الأصلي. */
export function sizeRank(value: string): number {
  const v = value.trim().toLowerCase();
  const n = Number(v.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
  if (v !== "" && Number.isFinite(n)) return n;
  const i = SIZE_ORDER.indexOf(v);
  return i >= 0 ? 1000 + i : 10_000;
}

/**
 * قيم خيار واحد بالترتيب: ترتيب تعريف الخيار (option_meta) أولاً، وإلا مقاسات على سلمها،
 * وإلا ترتيب أول ظهور في التركيبات حسب sort_order.
 */
export function orderedOptionValues(
  index: number,
  optionName: string,
  variants: { optionValues: string[]; sortOrder?: number }[],
  meta: OptionDef[] = []
): string[] {
  const sorted = [...variants].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const seen: string[] = [];
  for (const v of sorted) {
    const val = v.optionValues[index];
    if (val && !seen.includes(val)) seen.push(val);
  }
  const def = meta.find((m) => m.name === optionName);
  if (def?.values.length) {
    const rank = (s: string) => {
      const k = def.values.findIndex((x) => x.label === s);
      return k < 0 ? 9999 : k;
    };
    return seen.map((s, k) => ({ s, k })).sort((a, b) => rank(a.s) - rank(b.s) || a.k - b.k).map((x) => x.s);
  }
  if (seen.length && seen.every((s) => sizeRank(s) < 10_000)) {
    return seen.map((s, k) => ({ s, k })).sort((a, b) => sizeRank(a.s) - sizeRank(b.s) || a.k - b.k).map((x) => x.s);
  }
  return seen;
}

/** لون الدائرة: hex معرّف في option_meta، وإلا من اسم اللون المعروف، وإلا null. */
export function swatchColor(optionName: string, value: string, meta: OptionDef[] = []): string | null {
  const def = meta.find((m) => m.name === optionName);
  const hex = def?.values.find((v) => v.label === value)?.hex;
  if (hex && /^#[0-9a-f]{3,8}$/i.test(hex)) return hex;
  if (def?.kind && def.kind !== "color") return null;
  if (!def && !/لون|color/i.test(optionName)) return null;
  return colorFromName(value);
}

export type Tier = { minQty: number; percentOff: number };

export function sortedTiers(tiers: Tier[] | null | undefined): Tier[] {
  return (tiers ?? []).filter((t) => t.minQty >= 2 && t.percentOff > 0 && t.percentOff < 100).sort((a, b) => a.minQty - b.minQty);
}

/** الشريحة المنطبقة على كمية (الأعلى minQty التي تبلغها الكمية). */
export function activeTier(tiers: Tier[], qty: number): Tier | null {
  let best: Tier | null = null;
  for (const t of sortedTiers(tiers)) if (qty >= t.minQty && (!best || t.minQty > best.minQty)) best = t;
  return best;
}

/** السعر النهائي للوحدة بعد خصم الكمية (قروش، مقرّب). */
export function tierUnitPrice(unitPiasters: number, tiers: Tier[], qty: number): number {
  const t = activeTier(tiers, qty);
  return t ? Math.round(unitPiasters * (1 - t.percentOff / 100)) : unitPiasters;
}

export function tierLabel(t: Tier): string {
  return `${t.minQty} قطع أو أكثر: خصم ${t.percentOff}%`;
}

const CAIRO = "Africa/Cairo";
const DAY = 86_400_000;

function cairoParts(d: Date) {
  const f = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { timeZone: CAIRO, weekday: "long", day: "numeric", month: "long" }).formatToParts(d);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return { weekday: get("weekday"), day: get("day"), month: get("month") };
}

const isFriday = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: CAIRO, weekday: "short" }).format(d) === "Fri";

/** نطاق موعد التوصيل بتوقيت القاهرة. الجمعة لا تُعد يوم توصيل. */
export function deliveryRange(now: Date, minDays: number, maxDays: number): { from: Date; to: Date; text: string } {
  const add = (n: number) => {
    let d = new Date(now.getTime());
    let left = Math.max(0, Math.round(n));
    while (left > 0) {
      d = new Date(d.getTime() + DAY);
      if (!isFriday(d)) left--;
    }
    return d;
  };
  const from = add(Math.min(minDays, maxDays));
  const to = add(Math.max(minDays, maxDays));
  const a = cairoParts(from);
  const b = cairoParts(to);
  const text =
    a.day === b.day && a.month === b.month
      ? `${a.weekday} ${a.day} ${a.month}`
      : a.month === b.month
        ? `بين ${a.weekday} ${a.day} و${b.weekday} ${b.day} ${b.month}`
        : `بين ${a.weekday} ${a.day} ${a.month} و${b.weekday} ${b.day} ${b.month}`;
  return { from, to, text };
}

export const QUESTION_MIN = 8;
export const QUESTION_MAX = 400;

/** تحقق سؤال المنتج: إلزامي بطول معقول، بلا روابط، والاسم اختياري. */
export function validateQuestion(input: { question: string; name?: string }): { ok: true; question: string; name: string | null } | { ok: false; error: string } {
  const q = input.question.replace(/\s+/g, " ").trim();
  if (q.length < QUESTION_MIN) return { ok: false, error: "اكتبوا سؤالاً أوضح (8 أحرف على الأقل)" };
  if (q.length > QUESTION_MAX) return { ok: false, error: `السؤال طويل (الحد ${QUESTION_MAX} حرفاً)` };
  if (/https?:\/\/|www\./i.test(q)) return { ok: false, error: "لا يمكن إرسال روابط في الأسئلة" };
  const name = (input.name ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  return { ok: true, question: q, name: name || null };
}
