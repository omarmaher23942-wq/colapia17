// seo-meta.ts — بناة العناوين والأوصاف وروابط الصفحات البديلة لمحركات البحث (منطق خالص مختبَر).
//
// القاعدة: ما يظهر في نتائج البحث يُبنى من بيانات المتجر الفعلية (الاسم، الشعار النصي، الأقسام، السياسات) ولا يُخترع.
// العنوان يبدأ باسم المتجر دائماً ليأتي المتجر أولاً عند البحث باسمه، ثم ما يميّزه.
import type { StoreBlueprint } from "@/blueprint/schema";
import type { StoreFact } from "@/blueprint/facts";

export type SeoLocale = { language: string; country: string; currency: string };

export const TITLE_MAX = 70;
export const DESCRIPTION_MAX = 160;

/** لغة المتجر ودولته وعملته من الـ Blueprint (مع افتراضات آمنة لنسخة قديمة بلا الحقول). */
export function seoLocale(bp?: { locale?: Partial<StoreBlueprint["locale"]> } | null): SeoLocale {
  return {
    language: bp?.locale?.language ?? "ar",
    country: bp?.locale?.country ?? "EG",
    currency: bp?.locale?.currency ?? "EGP",
  };
}

/** ar_EG: الصيغة التي تطلبها Open Graph. */
export const ogLocale = (l: SeoLocale) => `${l.language}_${l.country}`;
/** ar-EG: الصيغة التي يطلبها hreflang. */
export const hreflang = (l: SeoLocale) => `${l.language}-${l.country}`;

/** canonical مع hreflang ذاتي (لغة واحدة): المسار نسبي ويكمله metadataBase. */
export function pageAlternates(path: string, l: SeoLocale) {
  return { canonical: path, languages: { [hreflang(l)]: path, "x-default": path } };
}

// ─── النص ─────────────────────────────────────────────────────────────────

/** نص عادي من ماركداون أو HTML: بلا روابط ولا علامات ولا أسطر متعددة. */
export function plainText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/[*_`~]{1,3}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** قصّ عند حدّ كلمة (لا في منتصفها) مع «…». */
export function clipText(s: string | null | undefined, max: number): string {
  const t = plainText(s);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  const base = space > max * 0.6 ? cut.slice(0, space) : cut;
  return `${base.trimEnd().replace(/[،,;:.\-–—|]+$/, "")}…`;
}

/** أول جملة (أو أول max حرفاً) من نص حر. */
export function leadSentence(s: string | null | undefined, max = 140): string {
  const t = plainText(s);
  if (!t) return "";
  const m = /^.{20,}?[.!؟?](?=\s|$)/.exec(t);
  const first = m ? m[0] : t;
  return clipText(first, max);
}

const norm = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ً-ٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/\s+/g, " ")
    .trim();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SEP_EDGES = /^[\s|\-–—:·،,]+|[\s|\-–—:·،,]+$/g;

/** يجعل اسم المتجر أول العنوان: مذكور أولاً يبقى، مذكور في موضع آخر يُنقل للبداية، وغائب يُضاف. */
export function nameFirst(title: string, name: string): string {
  const t = title.trim();
  const n = name.trim();
  if (!t) return n;
  if (!n) return t;
  const nt = norm(t);
  const nn = norm(n);
  if (nt === nn) return n;
  if (nt.startsWith(nn)) return t;
  const re = new RegExp(escapeRe(n), "i");
  if (re.test(t)) {
    const rest = t.replace(re, " ").replace(/\s+/g, " ").replace(SEP_EDGES, "").trim();
    return rest ? `${n} | ${rest}` : n;
  }
  return `${n} | ${t}`;
}

/** «الأساس | اسم المتجر» ضمن الحد، وإن تضمن الأساس اسم المتجر فلا يتكرر. */
export function composeTitle(primary: string, siteName: string, max = TITLE_MAX): string {
  const p = primary.trim();
  const s = siteName.trim();
  if (!s || norm(p).includes(norm(s))) return clipText(p, max);
  const whole = `${p} | ${s}`;
  if (whole.length <= max) return whole;
  const room = max - s.length - 3;
  return room >= 12 ? `${clipText(p, room)} | ${s}` : clipText(p, max);
}

// ─── الرئيسية ──────────────────────────────────────────────────────────────

/** «اسم المتجر | ما يميزه»: عنوان التاجر إن كتبه، ثم الشعار النصي، ثم أول قسمين، وإلا الاسم وحده. */
export function homeTitle(bp: Pick<StoreBlueprint, "brand" | "seo">, categoryNames: string[] = []): string {
  const name = bp.brand.name.trim();
  const custom = bp.seo.title?.trim();
  const hint = custom || bp.brand.tagline?.trim() || categoryNames.slice(0, 2).join("، ");
  return clipText(hint ? nameFirst(hint, name) : name, TITLE_MAX);
}

/** أهم حقائق السياسة التي تصلح في سطر وصف قصير (بترتيب الأهمية للمشتري). */
const SNIPPET_FACTS = ["cod", "free_shipping", "free_shipping_over", "nationwide", "returns", "fast_delivery"] as const;

export function factSnippets(facts: StoreFact[] | undefined, max = 2): string[] {
  if (!facts?.length) return [];
  const byKey = new Map(facts.map((f) => [f.key as string, f.title]));
  const out: string[] = [];
  for (const k of SNIPPET_FACTS) {
    const t = byKey.get(k);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** وصف الرئيسية: وصف التاجر إن وُجد، وإلا جملة من اسمه وأقسامه وأهم حقائقه. */
export function homeDescription(
  bp: Pick<StoreBlueprint, "brand" | "seo">,
  ctx: { categoryNames?: string[]; facts?: StoreFact[] } = {},
): string {
  const own = plainText(bp.seo.description || bp.brand.description);
  if (own) return clipText(own, DESCRIPTION_MAX);
  const name = bp.brand.name.trim();
  const cats = (ctx.categoryNames ?? []).slice(0, 3);
  const lead = cats.length ? `تسوقوا ${cats.join("، ")} من ${name}` : bp.brand.tagline?.trim() ? bp.brand.tagline.trim() : `متجر ${name} الإلكتروني`;
  const facts = factSnippets(ctx.facts);
  return clipText(facts.length ? `${lead}. ${facts.join(" · ")}.` : `${lead}.`, DESCRIPTION_MAX);
}

// ─── المنتج والقسم ─────────────────────────────────────────────────────────

export function priceLabel(piasters: number, currency: string): string {
  const amount = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2, numberingSystem: "latn" }).format(piasters / 100);
  return currency === "EGP" ? `${amount} ج.م` : `${amount} ${currency}`;
}

export type ProductMetaInput = {
  name: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  pricePiasters: number;
};

export function productTitle(p: Pick<ProductMetaInput, "name" | "seoTitle">, siteName: string): string {
  return composeTitle(p.seoTitle?.trim() || p.name.trim(), siteName);
}

/** وصف المنتج: ما كتبه التاجر، وإلا مطلع الوصف + السعر + أهم حقيقة شحن/دفع صحيحة الآن. */
export function productDescription(p: ProductMetaInput, ctx: { siteName: string; currency: string; facts?: StoreFact[] }): string {
  if (p.seoDescription?.trim()) return clipText(p.seoDescription, DESCRIPTION_MAX);
  const lead = leadSentence(p.shortDescription || p.description, 110) || `${p.name} من ${ctx.siteName}`;
  const pieces = [lead.replace(/[.!؟?…]+$/, ""), `السعر ${priceLabel(p.pricePiasters, ctx.currency)}`, ...factSnippets(ctx.facts, 1)];
  let out = "";
  for (const piece of pieces) {
    const next = out ? `${out}. ${piece}` : piece;
    if (next.length > DESCRIPTION_MAX - 1) break;
    out = next;
  }
  return out ? `${out}.` : clipText(lead, DESCRIPTION_MAX);
}

export function categoryDescription(cat: { name: string; description?: string | null }, ctx: { siteName: string; facts?: StoreFact[] }): string {
  if (cat.description?.trim()) return clipText(cat.description, DESCRIPTION_MAX);
  const facts = factSnippets(ctx.facts, 2);
  return clipText(`تسوقوا ${cat.name} من ${ctx.siteName}${facts.length ? `. ${facts.join(" · ")}` : ""}.`, DESCRIPTION_MAX);
}

// ─── تكرار المحتوى ─────────────────────────────────────────────────────────

/** معاملات تتبع وحملات لا تغيّر المحتوى: لا تجعل الصفحة «مفلترة» ولا تمنع فهرستها. */
const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|gbraid$|wbraid$|ttclid$|igshid$|igsh$|msclkid$|mc_|ref$|promo$|campaign$|_ga$|_gl$)/i;

/** هل في الاستعلام ما يغيّر المحتوى (فلتر أو ترتيب أو صفحة)؟ نعم ← canonical للصفحة الأصل وnoindex. */
export function isFilteredQuery(sp: Record<string, string | string[] | undefined>): boolean {
  return Object.entries(sp).some(([k, v]) => v !== undefined && v !== "" && !TRACKING_PARAM.test(k));
}

// ─── الأداء ────────────────────────────────────────────────────────────────

/** صورة أول قسم رئيسي (غلاف الواجهة): أولى الصور تحميلاً، وتُهيَّأ لها اتصال مسبق بمضيفها. */
export function heroImageUrl(bp: Pick<StoreBlueprint, "home">): string | undefined {
  for (const s of bp.home) {
    if (s.type !== "hero") continue;
    const url = (s as { images?: { url: string }[] }).images?.[0]?.url;
    if (url) return url;
  }
  return undefined;
}

/** أصل (origin) رابط خارجي https لاتصال مسبق، أو undefined لرابط نسبي أو من أصل الصفحة نفسه. */
export function preconnectOrigin(url: string | undefined, pageOrigin: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url, pageOrigin);
    return u.protocol === "https:" && u.origin !== pageOrigin ? u.origin : undefined;
  } catch {
    return undefined;
  }
}
