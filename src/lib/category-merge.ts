// category-merge.ts — توحيد أقسام المنتجات (خالص ومختبَر). السبب الجذري لعيب «قسم لكل منتج»: كل صورة كانت تُقرأ منفردة
// وتقترح قسمها بلا علم بالباقي (والقراءات تجري بالتوازي)، فتنتج أسماء متقاربة بعدد المنتجات. هنا:
//  1) دمج الأسماء المتقاربة (مفرد/جمع، «ال»، تضمّن الكلمات، مرادفات التجزئة الشائعة)،
//  2) مطابقة أقسام المتجر الحالية أولاً،
//  3) سقف أقصى للأقسام الجديدة (6) بدمج الأصغر في الأقرب، وما لا قريب له يذهب لقسم «منتجات متنوعة».
import { normalizeArabic } from "@/lib/arabic";

export const MAX_CATEGORIES = 6;
export const MISC_CATEGORY = "منتجات متنوعة";

/** مرادفات تجزئة شائعة تُرجَع لجذر واحد (بعد التطبيع وحذف «ال»). */
const SYNONYMS: Record<string, string> = {
  شنط: "حقيب",
  شنطه: "حقيب",
  حقايب: "حقيب",
  حقائب: "حقيب",
  حقيبه: "حقيب",
  حقاءب: "حقيب",
  احذيه: "حذاء",
  حذاء: "حذاء",
  جزم: "حذاء",
  جزمه: "حذاء",
  كوتشي: "حذاء",
  كوتش: "حذاء",
  هدوم: "ملابس",
  لبس: "ملابس",
  ملابس: "ملابس",
  ملبس: "ملابس",
  اكسسوارات: "اكسسوار",
  اكسسوار: "اكسسوار",
  موبايلات: "موبايل",
  هواتف: "موبايل",
  هاتف: "موبايل",
  عطور: "عطر",
  برفان: "عطر",
  برفانات: "عطر",
  ساعات: "ساعه",
  نظارات: "نظار",
  نظاره: "نظار",
};

function stemToken(raw: string): string {
  let t = normalizeArabic(raw).replace(/[^\p{L}\p{N}]/gu, "");
  if (t.startsWith("ال") && t.length > 4) t = t.slice(2);
  if (SYNONYMS[t]) return SYNONYMS[t]!;
  // جمع المؤنث السالم فقط («ات»): «ون/ين» جزء من أصل كلمات كثيرة (بنطلون، جينز) فلا تُقصّ.
  if (t.length > 5 && t.endsWith("ات")) t = t.slice(0, -2);
  else if (t.length > 4 && t.endsWith("ه")) t = t.slice(0, -1);
  return SYNONYMS[t] ?? t;
}

/** رموز الاسم بعد التجذير (بلا واو العطف وأدوات الربط). */
export function categoryTokens(name: string): string[] {
  return name
    .split(/[\s/,،\-–—_|]+/)
    .map((w) => (w.length > 1 && w.startsWith("و") && w.length > 3 ? w.slice(1) : w))
    .map(stemToken)
    .filter((t) => t.length > 1 && t !== "و" && t !== "من" && t !== "في");
}

export const categoryKey = (name: string): string => categoryTokens(name).sort().join(" ");

const same = (a: string[], b: string[]) => a.length > 0 && a.length === b.length && a.every((t) => b.includes(t));
const subset = (a: string[], b: string[]) => a.length > 0 && a.every((t) => b.includes(t));

export type CategoryItem = { id: string; category: string };
export type CategoryPlan = {
  /** معرّف المنتج ← اسم القسم النهائي (المنتج بلا قسم لا يظهر). */
  assign: Record<string, string>;
  /** الأقسام النهائية المستعملة بترتيب كثرة المنتجات. */
  categories: string[];
  /** هل دُمج شيء أو قُيّد بالسقف. */
  changed: boolean;
};

type Cluster = { tokens: string[]; names: Map<string, number>; count: number; existing: string | null };

/**
 * يخطّط أقسام مجموعة منتجات. `existing` = أسماء أقسام المتجر الحالية (تُفضَّل ويُطابَق عليها).
 * `max` = أقصى عدد أقسام مختلفة بين هذه المنتجات.
 */
export function planCategories(items: readonly CategoryItem[], existing: readonly string[] = [], max = MAX_CATEGORIES): CategoryPlan {
  const names = new Map<string, number>();
  for (const it of items) {
    const n = it.category.replace(/\s+/g, " ").trim();
    if (n) names.set(n, (names.get(n) ?? 0) + 1);
  }
  const existingTokens = existing.map((e) => ({ name: e, tokens: categoryTokens(e) }));

  const clusters: Cluster[] = [];
  const clusterOf = new Map<string, Cluster>();
  // الأكثر تكراراً ثم الأقصر أولاً: الأقصر يصير جذر الدمج (تيشيرت ⊂ تيشيرت قطن).
  const ordered = [...names.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length);
  for (const [name, n] of ordered) {
    const tokens = categoryTokens(name);
    let cl = clusters.find((c) => same(c.tokens, tokens) || subset(c.tokens, tokens) || subset(tokens, c.tokens));
    if (!cl) {
      const ex = existingTokens.find((e) => same(e.tokens, tokens) || subset(e.tokens, tokens) || subset(tokens, e.tokens));
      cl = { tokens: ex ? ex.tokens : tokens, names: new Map(), count: 0, existing: ex?.name ?? null };
      clusters.push(cl);
    } else if (tokens.length < cl.tokens.length && !cl.existing) cl.tokens = tokens;
    cl.names.set(name, n);
    cl.count += n;
    clusterOf.set(name, cl);
  }

  // سقف الأقسام: ندمج الأصغر في الأقرب (أكبر اشتراك رموز)، وما لا قريب له يذهب إلى «منتجات متنوعة».
  let alive = [...clusters].sort((a, b) => b.count - a.count);
  let misc: Cluster | null = null;
  while (alive.length + (misc ? 1 : 0) > max && alive.length > 1) {
    const small = alive[alive.length - 1]!;
    const rest = alive.slice(0, -1);
    let best: Cluster | null = null;
    let bestScore = 0;
    for (const c of rest) {
      const score = small.tokens.filter((t) => c.tokens.includes(t)).length;
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
    if (!best) {
      if (!misc) misc = { tokens: [], names: new Map(), count: 0, existing: null };
      best = misc;
    }
    for (const [n, c] of small.names) {
      best.names.set(n, (best.names.get(n) ?? 0) + c);
      clusterOf.set(n, best);
    }
    best.count += small.count;
    alive = rest; // «المتنوعة» تُحسب خارج القائمة الحية فلا تُدمج في نفسها.
  }

  const label = (c: Cluster): string => {
    if (c === misc) return MISC_CATEGORY;
    if (c.existing) return c.existing;
    return [...c.names.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0]![0];
  };
  const assign: Record<string, string> = {};
  let changed = false;
  for (const it of items) {
    const n = it.category.replace(/\s+/g, " ").trim();
    if (!n) continue;
    const to = label(clusterOf.get(n)!);
    assign[it.id] = to;
    if (to !== it.category) changed = true;
  }
  const counts = new Map<string, number>();
  Object.values(assign).forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1));
  return { assign, categories: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c), changed };
}

/** يطبّق الخطة على مرشّحين (أو أي كائنات بمعرّف وقسم). */
export function applyCategoryPlan<T extends CategoryItem>(items: readonly T[], plan: CategoryPlan): T[] {
  return items.map((it) => (plan.assign[it.id] !== undefined && plan.assign[it.id] !== it.category ? { ...it, category: plan.assign[it.id]! } : it));
}

/**
 * يدمج قرار الذكاء الاصطناعي (أقسام مختارة + تعيين كل منتج لقسم) مع التوحيد الحتمي:
 * أي رقم قسم خارج النطاق أو منتج مُهمل يبقى بقسمه السابق ثم يمر بالدمج والسقف.
 */
export function mergeAiAssignment(
  items: readonly CategoryItem[],
  ai: { categories: string[]; assign: { i: number; c: number }[] },
): CategoryItem[] {
  const cats = ai.categories.map((c) => c.replace(/\s+/g, " ").trim().slice(0, 40)).filter(Boolean);
  const pick = new Map<number, string>();
  for (const a of ai.assign) if (Number.isInteger(a.i) && Number.isInteger(a.c) && cats[a.c]) pick.set(a.i, cats[a.c]!);
  return items.map((it, i) => ({ id: it.id, category: pick.get(i) ?? it.category }));
}
