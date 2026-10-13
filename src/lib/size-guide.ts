// size-guide.ts — جدول المقاسات ومساعد اختيار المقاس (الجولة 2.1). منطق خالص مختبَر يستخدمه المتجر واللوحة.
//
// التاجر ينشئ جدولاً أو أكثر (لكل المنتجات أو لأقسام محددة): أعمدة قياسات حرة (الصدر، الطول، طول القدم…) وصف لكل مقاس،
// ومدى اختياري للطول والوزن يُبنى عليه الاقتراح. العميل يكتب طوله ووزنه فيقترح المتجر المقاس، بصدق: إن لم تكفِ البيانات
// لا اقتراح، وإن وقع بين مقاسين يقول ذلك. المرتجع بسبب المقاس هو أول سبب للمرتجع في الملابس.
import { z } from "zod";

const n = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).max(300).nullable()).default(null);

export const sizeRowSchema = z.object({
  size: z.string().trim().min(1).max(12),
  cells: z.array(z.string().trim().max(12)).max(6).default([]),
  heightFrom: n,
  heightTo: n,
  weightFrom: n,
  weightTo: n,
});

export const sizeChartSchema = z.object({
  id: z.string().min(1).max(24),
  name: z.string().trim().min(1).max(40),
  /** "all" = كل المنتجات ذات خيار مقاس، أو أقسام محددة. */
  appliesTo: z.union([z.literal("all"), z.array(z.string().min(1).max(64)).max(50)]).default("all"),
  unit: z.enum(["سم", "إنش"]).default("سم"),
  columns: z.array(z.string().trim().min(1).max(20)).max(6).default([]),
  rows: z.array(sizeRowSchema).max(20).default([]),
  note: z.string().trim().max(200).default(""),
});

export const sizeGuideSchema = z.object({ charts: z.array(sizeChartSchema).max(10).default([]) }).default({});

export type SizeRow = z.infer<typeof sizeRowSchema>;
export type SizeChart = z.infer<typeof sizeChartSchema>;
export type SizeGuide = z.infer<typeof sizeGuideSchema>;
export type Fit = "tight" | "regular" | "loose";

/** هل الخيار خيار مقاس؟ (مقاس، المقاس، Size، قياس…) */
export const isSizeOption = (name: string) => /مقاس|قياس|size/i.test(name);

/** الجدول المناسب لمنتج: جدول قسمه أولاً ثم جدول «كل المنتجات». لا جدول لمنتج بلا خيار مقاس. */
export function chartFor(guide: SizeGuide | undefined, categoryId: string | null | undefined, optionNames: string[]): SizeChart | null {
  if (!guide?.charts.length || !optionNames.some(isSizeOption)) return null;
  const usable = guide.charts.filter((c) => c.rows.length);
  return (
    (categoryId ? usable.find((c) => Array.isArray(c.appliesTo) && c.appliesTo.includes(categoryId)) : undefined) ??
    usable.find((c) => c.appliesTo === "all") ??
    null
  );
}

/** هل يدعم الجدول الاقتراح (صف واحد على الأقل فيه مدى طول أو وزن)؟ */
export const canRecommend = (c: SizeChart) => c.rows.some((r) => (r.heightFrom != null && r.heightTo != null) || (r.weightFrom != null && r.weightTo != null));

const outside = (v: number, from: number | null, to: number | null) => (from == null || to == null ? null : v < from ? from - v : v > to ? v - to : 0);

export type Recommendation = { size: string; exact: boolean; alternative: string | null };

/**
 * المقاس المقترح من الطول (سم) والوزن (كجم). يُقاس بُعد العميل عن مدى كل مقاس (10 سم طولاً ≈ 6 كجم وزناً)، ويُختار
 * الأقرب؛ «exact» إن وقع داخل المديين. «مريح» يرفع مقاساً، و«ضيق» يخفضه فقط إن كان بين مقاسين.
 */
export function recommendSize(chart: SizeChart, input: { height?: number | null; weight?: number | null; fit?: Fit }): Recommendation | null {
  const { height, weight, fit = "regular" } = input;
  if (!height && !weight) return null;
  const scored = chart.rows
    .map((r, i) => {
      const h = height ? outside(height, r.heightFrom, r.heightTo) : null;
      const w = weight ? outside(weight, r.weightFrom, r.weightTo) : null;
      if (h == null && w == null) return null;
      const bigger = (height != null && r.heightTo != null && height > r.heightTo) || (weight != null && r.weightTo != null && weight > r.weightTo);
      return { i, score: (h ?? 0) / 10 + (w ?? 0) / 6, exact: (h ?? 0) === 0 && (w ?? 0) === 0, bigger };
    })
    .filter((x): x is { i: number; score: number; exact: boolean; bigger: boolean } => x !== null);
  if (!scored.length) return null;
  const best = scored.reduce((a, b) => (b.score < a.score ? b : a));
  let i = best.i;
  if (fit === "loose" && i < chart.rows.length - 1) i += 1;
  else if (fit === "tight" && !best.exact && i > 0) i -= 1;
  // بين مقاسين: المقاس المجاور في اتجاه العميل (أكبر إن تجاوز المدى، وأصغر إن نقص عنه).
  const other = best.exact ? null : chart.rows[best.i + (best.bigger ? 1 : -1)]?.size ?? null;
  const size = chart.rows[i]!.size;
  return { size, exact: best.exact && fit === "regular", alternative: other && other !== size ? other : null };
}

/** معرّف قصير لجدول جديد. */
export const newChartId = () => `sz${Math.random().toString(36).slice(2, 9)}`;

/** قوالب بدء بقيم شائعة في السوق المصري (يراجعها التاجر ويعدّلها لتطابق منتجاته؛ اللوحة تقول ذلك صراحة). */
export const SIZE_TEMPLATES: { key: string; label: string; chart: Omit<SizeChart, "id"> }[] = [
  {
    key: "tops",
    label: "تيشيرتات وقمصان",
    chart: {
      name: "مقاسات التيشيرتات",
      appliesTo: "all",
      unit: "سم",
      columns: ["عرض الصدر", "الطول"],
      note: "القياس والقطعة مفرودة على سطح مستوٍ.",
      rows: [
        { size: "S", cells: ["48", "68"], heightFrom: 155, heightTo: 165, weightFrom: 50, weightTo: 62 },
        { size: "M", cells: ["51", "71"], heightFrom: 163, heightTo: 172, weightFrom: 60, weightTo: 72 },
        { size: "L", cells: ["54", "73"], heightFrom: 170, heightTo: 178, weightFrom: 70, weightTo: 82 },
        { size: "XL", cells: ["57", "75"], heightFrom: 176, heightTo: 184, weightFrom: 80, weightTo: 92 },
        { size: "XXL", cells: ["60", "77"], heightFrom: 182, heightTo: 192, weightFrom: 90, weightTo: 105 },
      ],
    },
  },
  {
    key: "dresses",
    label: "فساتين وعبايات",
    chart: {
      name: "مقاسات الفساتين",
      appliesTo: "all",
      unit: "سم",
      columns: ["الصدر", "الوسط", "الطول"],
      note: "",
      rows: [
        { size: "S", cells: ["86", "70", "135"], heightFrom: 150, heightTo: 160, weightFrom: 45, weightTo: 55 },
        { size: "M", cells: ["92", "76", "138"], heightFrom: 156, heightTo: 165, weightFrom: 53, weightTo: 63 },
        { size: "L", cells: ["98", "82", "140"], heightFrom: 160, heightTo: 170, weightFrom: 61, weightTo: 72 },
        { size: "XL", cells: ["104", "88", "142"], heightFrom: 163, heightTo: 173, weightFrom: 70, weightTo: 82 },
        { size: "XXL", cells: ["110", "94", "144"], heightFrom: 165, heightTo: 176, weightFrom: 80, weightTo: 95 },
      ],
    },
  },
  {
    key: "pants",
    label: "بناطيل وجينز",
    chart: {
      name: "مقاسات البناطيل",
      appliesTo: "all",
      unit: "سم",
      columns: ["الوسط", "طول الرجل"],
      note: "",
      rows: [
        { size: "30", cells: ["76", "100"], heightFrom: 160, heightTo: 170, weightFrom: 55, weightTo: 65 },
        { size: "32", cells: ["81", "102"], heightFrom: 165, heightTo: 175, weightFrom: 63, weightTo: 74 },
        { size: "34", cells: ["86", "104"], heightFrom: 170, heightTo: 180, weightFrom: 72, weightTo: 83 },
        { size: "36", cells: ["91", "106"], heightFrom: 174, heightTo: 184, weightFrom: 81, weightTo: 92 },
        { size: "38", cells: ["96", "108"], heightFrom: 178, heightTo: 190, weightFrom: 90, weightTo: 104 },
      ],
    },
  },
  {
    key: "shoes",
    label: "أحذية",
    chart: {
      name: "مقاسات الأحذية",
      appliesTo: "all",
      unit: "سم",
      columns: ["طول القدم"],
      note: "طول القدم من الكعب لأطول إصبع، والقدم على الأرض.",
      rows: [
        { size: "38", cells: ["24"], heightFrom: null, heightTo: null, weightFrom: null, weightTo: null },
        { size: "39", cells: ["24.7"], heightFrom: null, heightTo: null, weightFrom: null, weightTo: null },
        { size: "40", cells: ["25.3"], heightFrom: null, heightTo: null, weightFrom: null, weightTo: null },
        { size: "41", cells: ["26"], heightFrom: null, heightTo: null, weightFrom: null, weightTo: null },
        { size: "42", cells: ["26.7"], heightFrom: null, heightTo: null, weightFrom: null, weightTo: null },
        { size: "43", cells: ["27.3"], heightFrom: null, heightTo: null, weightFrom: null, weightTo: null },
        { size: "44", cells: ["28"], heightFrom: null, heightTo: null, weightFrom: null, weightTo: null },
      ],
    },
  },
  {
    key: "blank",
    label: "جدول فارغ",
    chart: { name: "جدول المقاسات", appliesTo: "all", unit: "سم", columns: ["القياس"], note: "", rows: [{ size: "M", cells: [""], heightFrom: null, heightTo: null, weightFrom: null, weightTo: null }] },
  },
];
