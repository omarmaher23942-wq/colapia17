// specs.ts — سمات المنتج الحقيقية (خالص ومختبَر): جدول السمات في صفحة المنتج، ومقارنة منتجين، وفلترة القائمة.
// المصدر الوحيد بيانات المنتج نفسه: attributes (ما كتبه التاجر) + خيارات التركيبات المتاحة (مقاس، لون، سعة...).
// لا سمة مخترعة: ما لا يوجد لا يظهر.

export type SpecInput = {
  attributes?: unknown;
  optionNames?: string[] | null;
  variants?: Array<{ optionValues?: string[] | null; isAvailable?: boolean | null }> | null;
};
export type Spec = { label: string; value: string };

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "");
const key = (s: string) => s.toLowerCase().replace(/[ً-ْ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim();

/** سمات التاجر المكتوبة (label/value) بعد التنظيف وحذف المكرر. */
export function writtenSpecs(attributes: unknown): Spec[] {
  if (!Array.isArray(attributes)) return [];
  const out: Spec[] = [];
  const seen = new Set<string>();
  for (const a of attributes) {
    if (!a || typeof a !== "object") continue;
    const label = clean((a as { label?: unknown }).label).slice(0, 60);
    const value = clean((a as { value?: unknown }).value).slice(0, 200);
    if (!label || !value || seen.has(key(label))) continue;
    seen.add(key(label));
    out.push({ label, value });
  }
  return out;
}

/** قيم كل خيار من التركيبات المتاحة فعلاً (بترتيب ظهورها). */
export function optionSpecs(p: SpecInput): Array<{ label: string; values: string[] }> {
  const names = (p.optionNames ?? []).map(clean).filter(Boolean);
  const vars = (p.variants ?? []).filter((v) => v && v.isAvailable !== false);
  return names
    .map((label, i) => {
      const values: string[] = [];
      for (const v of vars) {
        const val = clean(v.optionValues?.[i]);
        if (val && !values.includes(val)) values.push(val);
      }
      return { label, values };
    })
    .filter((o) => o.values.length > 0);
}

/** جدول السمات: سمات التاجر أولاً، ثم الخيارات المتاحة (إن لم تُكتب بالاسم نفسه). */
export function productSpecs(p: SpecInput): Spec[] {
  const written = writtenSpecs(p.attributes);
  const have = new Set(written.map((s) => key(s.label)));
  const opts = optionSpecs(p)
    .filter((o) => !have.has(key(o.label)))
    .map((o) => ({ label: `${o.label} المتاح`, value: o.values.join("، ") }));
  return [...written, ...opts];
}

export type CompareRow = { label: string; a: string; b: string; differs: boolean };

/** صفوف مقارنة منتجين: اتحاد السمات بالترتيب، و«—» لما لا يذكره أحدهما، مع تمييز المختلف. */
export function compareRows(a: SpecInput, b: SpecInput): CompareRow[] {
  const sa = productSpecs(a);
  const sb = productSpecs(b);
  const labels: string[] = [];
  for (const s of [...sa, ...sb]) if (!labels.some((l) => key(l) === key(s.label))) labels.push(s.label);
  const find = (list: Spec[], l: string) => list.find((s) => key(s.label) === key(l))?.value ?? "—";
  return labels.map((label) => {
    const va = find(sa, label);
    const vb = find(sb, label);
    return { label, a: va, b: vb, differs: key(va) !== key(vb) };
  });
}

export type Facet = { label: string; values: Array<{ value: string; count: number }> };

/** قيم مفردة لسمة في منتج: من الخيارات المتاحة (كل قيمة) ومن السمة المكتوبة (قيمة واحدة). */
function valuesOf(p: SpecInput): Map<string, { label: string; values: Set<string> }> {
  const m = new Map<string, { label: string; values: Set<string> }>();
  const add = (label: string, value: string) => {
    const k = key(label);
    if (!k || !value) return;
    const cur = m.get(k) ?? { label, values: new Set<string>() };
    cur.values.add(value);
    m.set(k, cur);
  };
  for (const o of optionSpecs(p)) for (const v of o.values) add(o.label, v);
  for (const s of writtenSpecs(p.attributes)) if (s.value.length <= 40) add(s.label, s.value);
  return m;
}

/**
 * فلاتر من السمات الحقيقية لقائمة منتجات: تظهر السمة إن وُجدت في منتجين على الأقل وبقيمتين مختلفتين على الأقل
 * (فلتر بقيمة واحدة لا يفيد)، وبحد 24 قيمة لكل سمة و6 سمات.
 */
export function attributeFacets(list: SpecInput[]): Facet[] {
  const agg = new Map<string, { label: string; products: number; counts: Map<string, number> }>();
  for (const p of list) {
    for (const [k, { label, values }] of valuesOf(p)) {
      const cur = agg.get(k) ?? { label, products: 0, counts: new Map<string, number>() };
      cur.products++;
      for (const v of values) cur.counts.set(v, (cur.counts.get(v) ?? 0) + 1);
      agg.set(k, cur);
    }
  }
  return [...agg.values()]
    .filter((f) => f.products >= 2 && f.counts.size >= 2 && f.counts.size <= 24)
    .sort((x, y) => y.products - x.products)
    .slice(0, 6)
    .map((f) => ({ label: f.label, values: [...f.counts.entries()].map(([value, count]) => ({ value, count })).sort((x, y) => y.count - x.count || x.value.localeCompare(y.value, "ar")) }));
}

/** هل يطابق المنتج الاختيارات؟ (أي قيمة داخل السمة نفسها، وكل السمات معاً). */
export function matchesFacets(p: SpecInput, selected: Record<string, string[]>): boolean {
  const vals = valuesOf(p);
  for (const [label, chosen] of Object.entries(selected)) {
    if (!chosen.length) continue;
    const have = vals.get(key(label));
    if (!have || !chosen.some((c) => have.values.has(c))) return false;
  }
  return true;
}
