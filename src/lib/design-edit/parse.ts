// parse.ts — فهم مباشر (حتمي) للطلبات الشائعة بلا أي خدمة خارجية: «خلفية بيضاء»، «كبّروا الخط»، «الأزرار سوداء ومدوّرة»،
// «أخفوا الأسئلة الشائعة»، «شريط الإعلان: شحن مجاني». كل جملة تُفهم تتحول إلى عمليات على مسارات الخريطة نفسها،
// وما لا يُفهم يبقى «غير محلول» ليتولاه الفهم الموسّع (server/design-tweak.ts). خالص ومختبَر.
import type { StoreBlueprint } from "@/blueprint/schema";
import { contrastRatio } from "@/blueprint/palette";
import { THEMES } from "@/blueprint/themes";
import { colorsIn, type ColorHit } from "./colors";
import type { DesignOp } from "./apply";
import { editableFields } from "./schema-map";

export type ParseResult = { ops: DesignOp[]; understood: string[]; unresolved: string[] };

const DIAC = /[ً-ٰٟـ]/g;
/** حذف التشكيل والتطويل فقط (يبقي الهمزات لأسماء الألوان). */
export const clean = (s: string) => s.replace(DIAC, "");
/** توحيد للمطابقة: أ/إ/آ ← ا، ى ← ي، ة ← ه، وحروف لاتينية صغيرة. */
export const norm = (s: string) => clean(s).replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").toLowerCase();

const has = (re: RegExp, s: string) => re.test(s);

// ─── الأهداف (بصيغة موحّدة) ──────────────────────────────────────────────────
const T_BG = /(خلفي\S*(?!\S)(?!\s+(ال)?(ازرار|زرار|زراير|زر|بطاق|كروت|كرت|هيدر|شريط))|background|\bbg\b|لون (الموقع|الصفحه|المتجر)|الارضيه)/;
const T_BUTTONS = /(ازرار|زرار|زراير|(^|\s)(ال)?زر(\s|$)|buttons?|\bcta\b)/;
const T_TEXT = /(لون (الكلام|الكتابه|النص|النصوص|الخط)|الكلام|الكتابه|النصوص|(^|\s)النص(\s|$)|text colou?r|\btext\b)/;
const T_FONTWORD = /(الخط|خط|الخطوط|فونت|font)/;
const T_ACCENT = /(المميز|اللون الثاني|الثانوي|accent|الشارات)/;
const T_CARDS = /(البطاقات|بطاقه|بطاقات|الكروت|كروت|كرت|cards?)/;
const T_PRIMARY = /(لون العلامه|اللون الاساسي|primary|البراند|brand colou?r)/;
const T_BORDER = /(الحدود|الاطار|البوردر|border)/;
const T_HEADER = /(الهيدر|هيدر|header|الشريط العلوي|navbar|القائمه العلويه)/;
const T_HEADINGS = /(العناوين|عناوين|headings?)/;
const T_LOGO = /(الشعار|شعار|اللوجو|لوجو|logo)/;

const BIGGER = /(اكبر|كبر|تكبير|bigger|larger|increase|زود|ازيد)/;
const SMALLER = /(اصغر|صغر|تصغير|smaller|decrease|قلل|اقل)/;
const AMOUNT_SMALL = /(شويه|شوي|قليلا|قليل|بسيط|بسيطه|a bit|slightly|little)/;
const AMOUNT_BIG = /(جدا|خالص|كتير|اوي|قوي|very|much|a lot)/;

const HIDE = /(اخف|اخفي|اخفو|خبي|خبو|شيل|شيلو|احذف|احذفو|امسح|امسحو|الغي|الغو|hide|remove|بدون|من غير)/;
const SHOW = /(اظهر|اظهرو|رجع|رجعو|ارجع|اعرض|اعرضو|show|unhide)/;

const SECTION_WORDS: [RegExp, string][] = [
  [/(الاسئله الشائعه|الاسئله|اسئله|faq)/, "faq"],
  [/(اراء العملاء|التقييمات|الاراء|اراء|testimonials|reviews)/, "testimonials"],
  [/(شارات الثقه|الثقه|trust)/, "trust_badges"],
  [/(من نحن|about)/, "about"],
  [/(قصه العلامه|قصه البراند|القصه|brand story)/, "brand_story"],
  [/(كيف تطلب|خطوات الطلب|الخطوات|steps)/, "steps"],
  [/(القائمه البريديه|النشره البريديه|الاشتراك بالبريد|newsletter)/, "newsletter"],
  [/(تواصل معنا|التواصل|contact)/, "contact"],
  [/(انستجرام|انستاجرام|instagram)/, "instagram_gallery"],
  [/(شبكه المنتجات|المنتجات المميزه|المنتجات|products)/, "product_grid"],
  [/(الاقسام|التصنيفات|categories)/, "categories"],
  [/(بانر العرض|البانر|banner|promo)/, "promo_banner"],
  [/(الارقام|الاحصائيات|stats)/, "stats"],
  [/(قسم الفيديو|الفيديو|video)/, "video"],
  [/(الطقم|bundle)/, "bundle"],
  [/(العد التنازلي|countdown)/, "countdown_offer"],
];

const FONT_NAMES: [RegExp, string][] = [
  [/(كايرو|القاهره|cairo)/, "cairo"],
  [/(تجوال|tajawal)/, "tajawal"],
  [/(المراعي|almarai)/, "almarai"],
  [/(المسيري|messiri)/, "el_messiri"],
  [/(تشانغا|شانجا|changa)/, "changa"],
  [/(ريدكس|readex)/, "readex_pro"],
  [/(نوتو|كوفي|kufi)/, "noto_kufi"],
  [/(بلكس|plex|ibm)/, "ibm_plex_arabic"],
];
const FONT_STYLES: [RegExp, [string, string]][] = [
  [/(انيق|فخم|راقي|كلاسيك|elegant|luxury|classic)/, ["el_messiri", "tajawal"]],
  [/(ودود|مرح|لطيف|friendly|playful|fun)/, ["readex_pro", "almarai"]],
  [/(عصري|حديث|بسيط|modern|clean|simple)/, ["cairo", "cairo"]],
  [/(تقني|رسمي|tech|corporate)/, ["ibm_plex_arabic", "ibm_plex_arabic"]],
];

const THEME_WORDS: [RegExp, string][] = [
  [/(منتصف الليل|ميدنايت|midnight|زئبقي|mercury)/, "midnight-mercury"],
  [/(عاجي|ivory|اتيليه|atelier)/, "ivory-atelier"],
  [/(اسود وذهبي|اسود و ذهبي|نوار|noir)/, "noir-gold"],
  [/(مرجاني|coral)/, "coral-pop"],
  [/(مريمي|sage)/, "sage-minimal"],
  [/(نيون|neon)/, "neon-tech"],
  [/(رملي|صحراوي|desert)/, "desert-sand"],
  [/(جليدي|ثلجي|arctic|glass)/, "arctic-glass"],
];

const amount = (s: string) => (has(AMOUNT_BIG, s) ? 3 : has(AMOUNT_SMALL, s) ? 1 : 2);
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const round2 = (n: number) => Math.round(n * 100) / 100;
const step = <T extends string>(list: readonly T[], cur: T, d: number): T => list[clamp(list.indexOf(cur) + d, 0, list.length - 1)]!;

// ─── تقسيم الطلب إلى جمل ─────────────────────────────────────────────────────
function protectQuotes(text: string): { text: string; quotes: string[] } {
  const quotes: string[] = [];
  let t = text.replace(/[«"“”„']([^«»"“”„']{1,400})[»"“”']/g, (_m, q: string) => `⟦${quotes.push(q.trim()) - 1}⟧`);
  // «شريط الإعلان: نص…» و«العنوان: نص…»: كل ما بعد النقطتين قيمة واحدة حتى نهاية السطر.
  t = t.replace(/((?:شريط الإعلان|شريط الاعلان|الإعلان|الاعلان|العنوان الرئيسي|العنوان|السطر تحت العنوان|اسم المتجر|نص الفوتر)[^:\n：]{0,20})[:：]\s*([^\n]{1,400})/g, (_m, k: string, v: string) => `${k} ⟦${quotes.push(v.trim()) - 1}⟧`);
  return { text: t, quotes };
}

const INTENT_HINT = new RegExp(
  [T_BG, T_BUTTONS, T_TEXT, T_FONTWORD, T_ACCENT, T_CARDS, T_HEADER, T_HEADINGS, T_LOGO, BIGGER, SMALLER, HIDE, SHOW, /(زوايا|حواف|اركان|مسافات|حركه|ظل|وضع|تصميم|اعلان|عنوان)/]
    .map((r) => r.source)
    .join("|")
);

export function splitClauses(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/[،,.؛;!؟?\n]+|\s+ثم\s+|\s+(?:and|also|then)\s+|\s+(?:وكمان|وكذلك|وايضا|وأيضاً|وأيضا)\s+/i)) {
    const pieces = part.split(/\s+(?=و\S)/);
    let cur = "";
    for (const p of pieces) {
      const n = norm(p.replace(/^و/, ""));
      if (cur && INTENT_HINT.test(n) && INTENT_HINT.test(norm(cur))) {
        out.push(cur.trim());
        cur = p;
      } else cur = cur ? `${cur} ${p}` : p;
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out.filter((c) => c.replace(/[\s⟦⟧\d]/g, "").length > 1 || /⟦\d+⟧/.test(c));
}

// ─── المعالجات ────────────────────────────────────────────────────────────────
type Ctx = { bp: StoreBlueprint; quotes: string[]; fieldPaths: Set<string>; enumOf: (p: string) => string[] | undefined };

const quoteIn = (c: string, q: string[]) => {
  const m = /⟦(\d+)⟧/.exec(c);
  return m ? q[Number(m[1])] : undefined;
};

function colorFor(hits: ColorHit[], clause: string, targetRe: RegExp): ColorHit | undefined {
  if (!hits.length) return undefined;
  const n = norm(clause);
  // «من الأحمر للأسود»: اللون الأخير هو المطلوب.
  if (hits.length > 1 && /(^|\s)من\s/.test(n)) return hits[hits.length - 1];
  const m = targetRe.exec(n);
  if (m) {
    const after = hits.find((h) => h.index >= m.index);
    if (after) return after;
  }
  return hits[hits.length - 1];
}

function colorOps(c: string, n: string, ctx: Ctx): DesignOp[] {
  const hits = colorsIn(clean(c));
  const ops: DesignOp[] = [];
  const p = ctx.bp.theme.palette;
  const bgTarget = has(T_BG, n);
  const kinds = ctx.enumOf("theme.background.kind") ?? ctx.enumOf("theme.background.type");
  const kindPath = ctx.enumOf("theme.background.kind") ? "theme.background.kind" : "theme.background.type";

  if (bgTarget && /(متدرج|تدرج|جريدينت|gradient)/.test(n)) {
    // التدرج يُكتب في الحقلين: نوع خلفية التصميم (V3) وسطح المتجر (المتاجر الأقدم).
    if (kinds?.includes("gradient")) ops.push({ path: kindPath, value: "gradient" });
    ops.push({ path: "design.surface.background", value: "soft_gradient" });
  } else if (bgTarget && /(ساده|سادة|بدون زخرف|بلا زخرف|solid|plain)/.test(n)) {
    if (kinds?.includes("solid")) ops.push({ path: kindPath, value: "solid" });
    ops.push({ path: "design.surface.background", value: "solid" });
  } else if (bgTarget && /(نقط|dots)/.test(n)) ops.push({ path: "design.surface.background", value: "dots" });
  else if (bgTarget && /(نسيج|ورق|texture|paper)/.test(n)) ops.push({ path: "design.surface.background", value: "paper" });

  if (!hits.length) {
    if (bgTarget && !ops.length && /(فاتح|فاتحه|light)/.test(n)) ops.push({ path: "theme.mode", value: "light" });
    if (bgTarget && !ops.length && /(داكن|داكنه|غامق|غامقه|dark)/.test(n)) ops.push({ path: "theme.mode", value: "dark" });
    return ops;
  }

  const buttons = has(T_BUTTONS, n);
  const text = has(T_TEXT, n) || (has(T_FONTWORD, n) && !has(BIGGER, n) && !has(SMALLER, n));
  const targets: [RegExp, string][] = [];
  if (buttons && text) targets.push([T_TEXT, "theme.palette.primaryForeground"]);
  else {
    if (bgTarget) targets.push([T_BG, "theme.palette.background"]);
    if (buttons) targets.push([T_BUTTONS, "theme.palette.primary"]);
    if (text && !bgTarget && !buttons) targets.push([T_TEXT, "theme.palette.foreground"]);
    if (has(T_ACCENT, n)) targets.push([T_ACCENT, "theme.palette.accent"]);
    if (has(T_CARDS, n) && !buttons) targets.push([T_CARDS, "theme.palette.card"]);
    if (has(T_PRIMARY, n) && !buttons) targets.push([T_PRIMARY, "theme.palette.primary"]);
    if (has(T_BORDER, n)) targets.push([T_BORDER, "theme.palette.border"]);
  }
  if (targets.length) {
    for (const [re, path] of targets) {
      const h = colorFor(hits, c, re);
      if (h) ops.push({ path, value: h.hex, reason: `ذُكر ${h.name}` });
    }
    return ops;
  }
  // بلا هدف: «غيّروا الأسود للأبيض» ← اللون الحالي الأقرب للأول (الخلفية أو النص أو الأزرار) يصير الثاني.
  if (hits.length >= 2 && /(غير|بدل|حول|خلي|اجعل|change|replace|turn)/.test(n)) {
    const [from, to] = [hits[0]!, hits[hits.length - 1]!];
    const dist = (a: string, b: string) => {
      const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
      return ((x >> 16) - (y >> 16)) ** 2 + (((x >> 8) & 255) - ((y >> 8) & 255)) ** 2 + ((x & 255) - (y & 255)) ** 2;
    };
    const cands: [string, string][] = [["theme.palette.background", p.background], ["theme.palette.foreground", p.foreground], ["theme.palette.primary", p.primary]];
    const best = cands.sort((a, b) => dist(a[1], from.hex) - dist(b[1], from.hex))[0]!;
    // النص لا يُغيَّر إلى لون لا يُقرأ على الخلفية: هذا طلب غامض يُترك للفهم الموسّع.
    const unreadableText = best[0] === "theme.palette.foreground" && contrastRatio(to.hex, p.background) < 3;
    if (dist(best[1], from.hex) < 9000 && !unreadableText) ops.push({ path: best[0], value: to.hex, reason: `${from.name} ← ${to.name}` });
    return ops;
  }
  // «خلّوا المتجر/الموقع أبيض»: الخلفية.
  if (hits.length === 1 && /(المتجر|الموقع|الصفحه|الشكل كله|store|site)/.test(n)) ops.push({ path: "theme.palette.background", value: hits[0]!.hex });
  return ops;
}

function sizeOps(n: string, ctx: Ctx): DesignOp[] {
  const up = has(BIGGER, n);
  const down = has(SMALLER, n) && !up;
  if (!up && !down) return [];
  const d = (up ? 1 : -1) * amount(n);
  const bp = ctx.bp;
  if (has(T_BUTTONS, n)) return [{ path: "design.button.size", value: step(["sm", "md", "lg"] as const, bp.design.button.size, Math.sign(d)) }];
  if (has(T_LOGO, n)) return [{ path: "design.header.logoSize", value: step(["sm", "md", "lg"] as const, bp.design.header.logoSize, Math.sign(d)) }];
  if (has(/(مسافات|المسافات|الفراغات|spacing)/, n)) return [];
  if (has(T_HEADINGS, n)) return [{ path: "design.type.headingScale", value: round2(clamp(bp.design.type.headingScale + 0.08 * d, 0.85, 1.35)) }];
  if (has(T_FONTWORD, n) || has(T_TEXT, n) || has(/(حجم|size)/, n)) {
    return [
      { path: "theme.fonts.baseSize", value: clamp(bp.theme.fonts.baseSize + d, 14, 20) },
      { path: "design.type.headingScale", value: round2(clamp(bp.design.type.headingScale + 0.05 * d, 0.85, 1.35)) },
    ];
  }
  return [];
}

function fontOps(n: string): DesignOp[] {
  if (!has(T_FONTWORD, n)) return [];
  const headingsOnly = has(T_HEADINGS, n);
  for (const [re, id] of FONT_NAMES) if (re.test(n)) return headingsOnly ? [{ path: "theme.fonts.heading", value: id }] : [{ path: "theme.fonts.heading", value: id }, { path: "theme.fonts.body", value: id }];
  for (const [re, [h, b]] of FONT_STYLES) if (re.test(n)) return headingsOnly ? [{ path: "theme.fonts.heading", value: h }] : [{ path: "theme.fonts.heading", value: h }, { path: "theme.fonts.body", value: b }];
  return [];
}

function cornerOps(n: string): DesignOp[] {
  const cornerWord = has(/(زوايا|زاويه|حواف|حافه|اركان|corners?|radius)/, n);
  const shapeWord = /(دائري|مدور|مدوره|مستدير|استداره|rounded|round|حاد|حاده|مربع|مربعه|sharp|square|كبسول|pill|ناعم|ناعمه)/;
  if (!cornerWord && !(has(shapeWord, n) && (has(T_BUTTONS, n) || has(T_CARDS, n)))) return [];
  let radius: string | null = null;
  if (/(بدون استداره|حاد|حاده|مربع|مربعه|sharp|square|مستقيم)/.test(n)) radius = "none";
  else if (/(بالكامل|كبسول|pill|دائري تماما|دائريه تماما)/.test(n)) radius = "full";
  else if (/(اكثر استداره|اكتر|دائري|دائريه|مدور|مدوره|مستدير|rounded|round)/.test(n)) radius = "xl";
  else if (/(ناعم|ناعمه|خفيف|خفيفه|soft|قليل)/.test(n)) radius = "md";
  else if (has(SMALLER, n)) radius = "sm";
  if (!radius) return [];
  const px: Record<string, [number, number]> = { none: [0, 0], sm: [6, 6], md: [10, 10], xl: [22, 999], full: [28, 999] };
  const [card, button] = px[radius]!;
  const onlyButtons = has(T_BUTTONS, n) && !has(T_CARDS, n) && !cornerWord;
  const onlyCards = has(T_CARDS, n) && !has(T_BUTTONS, n) && !cornerWord;
  if (onlyButtons || (has(T_BUTTONS, n) && !has(T_CARDS, n))) return [{ path: "design.shape.button", value: button }];
  if (onlyCards || (has(T_CARDS, n) && !has(T_BUTTONS, n))) return [{ path: "design.shape.card", value: card }, { path: "design.shape.image", value: Math.min(card, 40) }];
  return [{ path: "theme.radius", value: radius }];
}

function buttonStyleOps(n: string): DesignOp[] {
  if (!has(T_BUTTONS, n)) return [];
  const map: [RegExp, string][] = [
    [/(مفرغ|مفرغه|فاضي|فاضيه|باطار|بإطار|بحدود|اوتلاين|outline|outlined)/, "outline"],
    [/(متدرج|متدرجه|تدرج|جريدينت|gradient)/, "gradient"],
    [/(زجاج|glass)/, "glass"],
    [/(ناعم|ناعمه|باهت|soft)/, "soft"],
    [/(مصمت|مصمته|مليان|مليانه|ساده|solid|filled)/, "solid"],
  ];
  for (const [re, v] of map) if (re.test(n)) return [{ path: "theme.buttonStyle", value: v }];
  return [];
}

function cardStyleOps(n: string): DesignOp[] {
  if (!has(T_CARDS, n)) return [];
  const map: [RegExp, string][] = [
    [/(باطار|بإطار|بحدود|bordered)/, "bordered"],
    [/(زجاج|glass)/, "glass"],
    [/(تحريري|مجله|editorial)/, "editorial"],
    [/(عائم|عائمه|floating)/, "floating"],
    [/(بظل|مرتفع|مرتفعه|elevated)/, "elevated"],
    [/(بسيط|بسيطه|minimal|clean)/, "minimal"],
    [/(النص فوق الصوره|overlay)/, "overlay"],
  ];
  for (const [re, v] of map) if (re.test(n)) return [{ path: "theme.productCardStyle", value: v }];
  return [];
}

function headerOps(n: string): DesignOp[] {
  if (!has(T_HEADER, n)) return [];
  const ops: DesignOp[] = [];
  if (/(زجاج|glass|ضبابي)/.test(n)) ops.push({ path: "design.header.surface", value: "glass" });
  else if (/(شفاف|transparent)/.test(n)) ops.push({ path: "design.header.surface", value: "transparent" });
  else if (/(باطار|بإطار|بخط|bordered)/.test(n)) ops.push({ path: "design.header.surface", value: "bordered" });
  else if (/(ساده|مصمت|solid)/.test(n)) ops.push({ path: "design.header.surface", value: "solid" });
  if (/(مش ثابت|غير ثابت|لا يثبت|يتحرك مع|not sticky)/.test(n)) ops.push({ path: "header.sticky", value: false });
  else if (/(ثابت|يثبت|sticky)/.test(n)) ops.push({ path: "header.sticky", value: true });
  if (/(الشعار في المنتصف|اللوجو في النص|centered)/.test(n)) ops.push({ path: "header.variant", value: "centered_logo" });
  return ops;
}

function spacingOps(n: string): DesignOp[] {
  if (!has(/(مسافات|المسافات|الفراغات|spacing|زحمه|مزدحم|مزحوم|براح|crowded)/, n)) return [];
  if (/(مزدحم|زحمه|مزحوم|crowded|اوسع|وسع|اكتر|اكثر|زود|براح|wider|more|airy)/.test(n)) return [{ path: "design.layout.density", value: "airy" }];
  if (/(اقل|اضيق|قلل|compact|tighter|less)/.test(n)) return [{ path: "design.layout.density", value: "compact" }];
  if (/(متوسط|عادي|متوازن|balanced|normal)/.test(n)) return [{ path: "design.layout.density", value: "balanced" }];
  return [];
}

function motionOps(n: string): DesignOp[] {
  if (!has(/(حركه|حركات|انيميشن|animation|motion)/, n)) return [];
  if (/(بدون|من غير|الغ|اوقف|stop|no )/.test(n)) return [{ path: "design.motion.level", value: "calm" }, { path: "design.motion.depth", value: false }];
  if (/(سينمائي|cinematic)/.test(n)) return [{ path: "design.motion.level", value: "cinematic" }];
  if (/(اقل|هادئ|هادي|هاديه|calm|less)/.test(n)) return [{ path: "design.motion.level", value: "calm" }];
  if (/(اكثر|اكتر|حيوي|حيويه|زود|more|lively)/.test(n)) return [{ path: "design.motion.level", value: "lively" }];
  return [];
}

function shadowOps(n: string, ctx: Ctx): DesignOp[] {
  if (!has(/(ظل|ظلال|shadow)/, n)) return [];
  const lvl = ctx.bp.design.elevation.level;
  if (/(بدون|من غير|الغ|no )/.test(n)) return [{ path: "design.elevation.level", value: 0 }, { path: "theme.shadow", value: "none" }];
  if (has(BIGGER, n) || /(اقوي|اوضح|stronger)/.test(n)) return [{ path: "design.elevation.level", value: clamp(lvl + 1, 0, 4) }, { path: "theme.shadow", value: step(["none", "soft", "medium", "dramatic"] as const, ctx.bp.theme.shadow === "cinematic" ? "dramatic" : ctx.bp.theme.shadow, 1) }];
  if (has(SMALLER, n) || /(اخف|اهدي|softer)/.test(n)) return [{ path: "design.elevation.level", value: clamp(lvl - 1, 0, 4) }, { path: "theme.shadow", value: step(["none", "soft", "medium", "dramatic"] as const, ctx.bp.theme.shadow === "cinematic" ? "dramatic" : ctx.bp.theme.shadow, -1) }];
  return [];
}

function modeOps(n: string): DesignOp[] {
  const modeWord = /(وضع|مود|mode|الشكل كله|ثيم|theme|المتجر|الموقع)/.test(n);
  if (/(dark\s*mode|دارك)/.test(n) || (modeWord && /(داكن|ليلي|غامق|اسود|dark)/.test(n))) return [{ path: "theme.mode", value: "dark" }];
  if (/(light\s*mode|لايت)/.test(n) || (modeWord && /(فاتح|نهاري|light)/.test(n))) return [{ path: "theme.mode", value: "light" }];
  if (modeWord && /(تلقائي|حسب الجهاز|auto)/.test(n)) return [{ path: "theme.mode", value: "auto" }];
  return [];
}

function presetOps(n: string): DesignOp[] {
  if (!/(تصميم|ثيم|theme|ستايل|style|هويه)/.test(n)) return [];
  for (const [re, id] of THEME_WORDS) if (re.test(n) && THEMES.some((t) => t.id === id)) return [{ path: "theme.preset", value: id }];
  for (const t of THEMES) if (n.includes(norm(t.name))) return [{ path: "theme.preset", value: t.id }];
  return [];
}

function sectionOps(n: string, ctx: Ctx): DesignOp[] {
  const hide = has(HIDE, n);
  const show = has(SHOW, n) && !hide;
  if (!hide && !show) return [];
  if (/(شريط الاعلان|الاعلان|announcement)/.test(n)) {
    if (hide) return [{ path: "announcement.text", value: "" }];
    const t = ctx.bp.header.announcement?.items?.[0]?.text;
    return t ? [{ path: "header.announcement.enabled", value: true }] : [];
  }
  const ops: DesignOp[] = [];
  for (const [re, type] of SECTION_WORDS) {
    if (!re.test(n)) continue;
    for (const s of ctx.bp.home) if (s.type === type) ops.push({ path: `home:${s.id}.enabled`, value: show });
    if (ops.length) break;
  }
  return ops;
}

function textOps(c: string, n: string, ctx: Ctx): DesignOp[] {
  const q = quoteIn(c, ctx.quotes);
  if (q === undefined) return [];
  const hero = ctx.bp.home.find((s) => s.type === "hero");
  if (/(شريط الاعلان|الاعلان|البار|announcement)/.test(n)) return [{ path: "announcement.text", value: q.slice(0, 120) }];
  if (/(السطر تحت العنوان|النص الفرعي|تحت العنوان|subheadline|subtitle)/.test(n) && hero) return [{ path: `home:${hero.id}.subheadline`, value: q.slice(0, 220) }];
  if (/(العنوان الرئيسي|عنوان الواجهه|العنوان|headline)/.test(n) && hero) return [{ path: `home:${hero.id}.headline`, value: q.slice(0, 90) }];
  if (/(اسم المتجر|store name)/.test(n)) return [{ path: "brand.name", value: q.slice(0, 60) }];
  if (/(نص الفوتر|الفوتر|footer)/.test(n)) return [{ path: "footer.tagline", value: q.slice(0, 160) }];
  if (/(زر الاضافه|اضف للسله|زر السله|add to cart)/.test(n)) return [{ path: "copy.addToCart", value: q.slice(0, 24) }];
  if (/(زر الشراء|اشتري الان|buy now)/.test(n)) return [{ path: "copy.buyNow", value: q.slice(0, 24) }];
  return [];
}

/** يحوّل الطلب إلى عمليات ما أمكن فهمه مباشرة، ويعيد الجمل التي لم تُفهم. */
export function parseRequest(text: string, bp: StoreBlueprint): ParseResult {
  const fields = editableFields(bp);
  const enums = new Map(fields.filter((f) => f.kind === "enum").map((f) => [f.path, f.options!]));
  const { text: protectedText, quotes } = protectQuotes(clean(text).slice(0, 1200));
  const ctx: Ctx = { bp, quotes, fieldPaths: new Set(fields.map((f) => f.path)), enumOf: (p) => enums.get(p) };
  const ops: DesignOp[] = [];
  const understood: string[] = [];
  const unresolved: string[] = [];
  for (const clause of splitClauses(protectedText)) {
    const n = norm(clause);
    const found: DesignOp[] = [];
    const add = (xs: DesignOp[]) => {
      for (const x of xs) if (!found.some((y) => y.path === x.path)) found.push(x);
    };
    add(presetOps(n));
    add(textOps(clause, n, ctx));
    if (!found.length) add(sectionOps(n, ctx));
    add(colorOps(clause, n, ctx));
    add(sizeOps(n, ctx));
    add(fontOps(n));
    add(cornerOps(n));
    add(buttonStyleOps(n));
    add(cardStyleOps(n));
    add(headerOps(n));
    add(spacingOps(n));
    add(motionOps(n));
    add(shadowOps(n, ctx));
    if (!found.some((o) => o.path === "theme.mode" || o.path.startsWith("theme.palette."))) add(modeOps(n));
    const restored = clause.replace(/⟦(\d+)⟧/g, (_m, i: string) => `«${quotes[Number(i)] ?? ""}»`);
    if (found.length) {
      understood.push(restored);
      for (const o of found) if (!ops.some((y) => y.path === o.path)) ops.push(o);
    } else unresolved.push(restored);
  }
  return { ops, understood, unresolved };
}
