// keyword-reply.ts — الرد الآلي على كلمات الدعوة في منشورات إنستجرام («متجر»، «مشروع»، «تفاصيل»). خالص ومختبَر.
// قرار المالك (2026-10-29): الوكيل الذكي موقوف، لكن من يرسل كلمة الدعوة التي كتبناها في المنشورات يجب أن يصله رد فوري بالتفاصيل،
// ثم يرى الفريق الرسالة ويتابع. المطابقة لغوية متسامحة (تشكيل، همزات، ياء/ألف مقصورة، تاء مربوطة، أخطاء إملائية بحرف، حروف لاتينية)
// ولا تعمل إلا على الرسائل القصيرة: رسالة طويلة أو فيها شكوى تذهب للفريق بلا رد آلي.
import type { Offer } from "./offer";

export type KeywordRule = "store" | "project" | "offer";

/** تطبيع عربي/لاتيني: تشكيل وتطويل وهمزات وياء وتاء مربوطة وعلامات ترقيم وأرقام هندية. */
export function normalize(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "") // تشكيل وتطويل
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // علامات وإيموجي وأقواس «»
    .replace(/\s+/g, " ")
    .trim();
}

/** بدائل أحرف العطف والجر والتعريف الملتصقة بالكلمة. */
const PREFIXES = ["وبال", "وال", "بال", "كال", "فال", "لل", "ال", "و", "ب", "ل", "ف"];
export function stem(tok: string): string {
  for (const p of PREFIXES) if (tok.startsWith(p) && tok.length - p.length >= 3) return tok.slice(p.length);
  return tok;
}

function lev(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    let rowMin = prev[0]!;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
      rowMin = Math.min(rowMin, prev[j]!);
    }
    if (rowMin > max) return max + 1;
  }
  return prev[b.length]!;
}

// الصيغ المعتمدة لكل كلمة (بعد التطبيع). التسامح الإملائي (حرف واحد) يُطبَّق على ما طوله 4 أحرف فأكثر.
const FORMS: Record<KeywordRule, { exact: string[]; fuzzy: string[] }> = {
  store: {
    exact: ["متجر", "متاجر", "متجري", "متجرنا", "متجركم", "ستور", "store", "shop", "matgar", "matger", "mtgr", "متجرك", "ماتجر"],
    fuzzy: ["متجر", "متاجر", "store", "matgar"],
  },
  project: {
    exact: ["مشروع", "مشاريع", "مشروعي", "مشروعنا", "مشروعكم", "project", "projects"],
    fuzzy: ["مشروع", "مشاريع", "project"],
  },
  offer: {
    exact: ["تفاصيل", "تفصيل", "details", "detail", "عرض", "عروض", "اسعار", "سعر", "بكام", "كام", "price", "offer", "تكلفه", "التكلفه", "عرضكم", "تفاصيلكم"],
    fuzzy: ["تفاصيل", "details", "اسعار", "تكلفه", "price", "offer"],
  },
};

// كلمات حشو لا تُحسب في طول الرسالة (حتى تُقبل «عايز تفاصيل لو سمحت» و«ممكن أعرف عن المتجر»).
const FILLER = new Set(
  ("ابعت ابعتوا ابعتي ابعتولي ابعتلي ارسل ارسلوا لو سمحت سمحتم ممكن ياريت يارب رجاء فضلا من فضلك فضلكم عن في علي الي اللي هو هي ده دي دا ايه اي يا فندم " +
    "حضرتك حضرتكم لي لنا ليا انا نفسي عايز عايزه عاوز عاوزه اريد ارغب محتاج محتاجه اعرف اعرفوا عايزين ممكن تبعتوا تبعت ابغي اطلب طلب كلمه الكلمه " +
    "السلام عليكم مرحبا اهلا هلا صباح مساء الخير النور تحيه شكرا من اجل بخصوص بتاع بتاعكم ال").split(" ")
);

// رسالة فيها أحد هذه الكلمات شكوى أو طلب خارج الدعوة: تذهب للفريق بلا رد آلي.
const NEGATIVE = new Set(["مش", "مشكله", "شكوي", "الغاء", "الغي", "ارجاع", "استرجاع", "مرتجع", "نصب", "احتيال", "تاخير", "اتاخر", "معطل", "خربان", "وقف", "وقفت", "لا", "ليه"]);

/** أكبر عدد كلمات (بلا الحشو) لرسالة تُعدّ دعوة مباشرة. */
export const MAX_CONTENT_TOKENS = 4;
export const MAX_RAW_CHARS = 60;

const toks = (s: string) => normalize(s).split(" ").filter(Boolean);

function tokenMatches(rule: KeywordRule, tok: string): boolean {
  const { exact, fuzzy } = FORMS[rule];
  const forms = [tok, stem(tok)];
  if (forms.some((f) => exact.includes(f))) return true;
  return forms.some((f) => f.length >= 4 && fuzzy.some((w) => w.length >= 4 && lev(f, w, 1) <= 1));
}

/**
 * يحدد كلمة الدعوة في رسالة قصيرة. الأولوية عند اجتماع أكثر من كلمة: متجر، ثم مشروع، ثم تفاصيل/عرض
 * («تفاصيل المتجر» = متجر). ما عدا ذلك null: لا رد آلي ويقرأ الفريق الرسالة.
 */
export function matchKeyword(text: string | null | undefined): KeywordRule | null {
  if (!text || text.length > MAX_RAW_CHARS * 2) return null;
  const all = toks(text);
  if (!all.length) return null;
  if (all.some((t) => NEGATIVE.has(t) || NEGATIVE.has(stem(t)))) return null;
  const content = all.filter((t) => !FILLER.has(t));
  if (!content.length || content.length > MAX_CONTENT_TOKENS || text.length > MAX_RAW_CHARS) return null;
  for (const rule of ["store", "project", "offer"] as const) {
    if (content.some((t) => tokenMatches(rule, t))) return rule;
  }
  return null;
}

export type ReplyCtx = { offer: Offer; demoUrl: string; qimaUrl: string };

const egp = (n: number) => Math.round(n).toLocaleString("en-US");

/** سطر عرض الإطلاق: لا يظهر إلا والعرض متاح فعلاً بمقاعد باقية (المقاعد والسعر من النظام). */
function offerLine(o: Offer): string {
  if (!o.golden || !o.price) return "";
  return `🚀 عرض الإطلاق: ${egp(o.price)} جنيه لأول ${o.seatsTotal} عملاء ولجميع الخدمات، والمتبقي الآن ${o.seatsLeft} من ${o.seatsTotal}.`;
}

const CONTACT_ASK = "فريقنا سيطّلع على رسالتكم ويرد عليكم في أقرب وقت. ولتسريع الأمر، اكتبوا هنا اسمكم ورقم واتساب للتواصل.";

/** نص الرد على كل كلمة. لا يدّعي أنه بشر، ولا يذكر ما ليس حقيقة في المنتج. */
export function replyFor(rule: KeywordRule, ctx: ReplyCtx): string {
  const o = offerLine(ctx.offer);
  if (rule === "store") {
    return [
      "أهلاً بكم في Colapia 🤍",
      "شكراً لاهتمامكم بمتجر إلكتروني لبراندكم. هذا ما نقدّمه:",
      "• متجر كامل بهوية براندكم، وطلب بالمقاس واللون وتتبع برقم الطلب",
      "• لوحة تحكم بالعربية لإدارة المنتجات والطلبات والمخزون من الموبايل والكمبيوتر",
      "• الكود ملككم ويُسلَّم على حساباتكم، بلا اشتراك شهري من Colapia، ونرافقكم حتى يعمل باسمكم",
      o,
      `جرّبوا نموذجاً حياً: ${ctx.demoUrl}`,
      `ومن أعمالنا: ${ctx.qimaUrl}`,
      CONTACT_ASK + " واذكروا نشاط البراند باختصار.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (rule === "project") {
    return [
      "أهلاً بكم في Colapia 🤍",
      "نبني مشروعكم الرقمي بهويتكم: متاجر إلكترونية، مواقع تعريفية، أنظمة حجز، لوحات تحكم، وتطبيقات ويب.",
      "• نبدأ بفهم فكرتكم ومتطلباتكم، ونتفق على نطاق المشروع قبل أي تنفيذ",
      "• الكود ملككم ويُسلَّم على حساباتكم، بلا اشتراك شهري من Colapia، ونرافقكم حتى يعمل باسمكم",
      o,
      `من أعمالنا: ${ctx.qimaUrl}`,
      `ونموذج متجر حي: ${ctx.demoUrl}`,
      CONTACT_ASK + " واحكوا لنا فكرة المشروع باختصار.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  const head = ctx.offer.golden && ctx.offer.price
    ? [
        "أهلاً بكم في Colapia 🤍",
        o,
        "• يشمل أي نظام أو موقع أو متجر، بتصميم مخصص لهويتكم ولوحة تحكم تناسب نوع نظامكم",
        "• الكود ملككم، بلا اشتراك شهري من Colapia، ومرافقة حتى يعمل على حساباتكم",
        "• لا عمولة على مبيعاتكم",
        "• المقابل: رأيكم الصريح بعد التسليم، وإمكانية عرض المشروع كمثال بموافقتكم على النسخة النهائية فقط",
      ]
    : [
        "أهلاً بكم في Colapia 🤍",
        "اكتملت أماكن عرض الإطلاق، لكن يسعدنا مناقشة مشروعكم وتحديد التكلفة حسب المتطلبات.",
        "• الكود ملككم، بلا اشتراك شهري من Colapia، ومرافقة حتى يعمل على حساباتكم",
      ];
  return [...head, `من أعمالنا: ${ctx.qimaUrl}`, `ونموذج متجر حي: ${ctx.demoUrl}`, CONTACT_ASK + " واذكروا الخدمة التي تحتاجونها."].filter(Boolean).join("\n");
}
