// manual-order.ts — «طلب من الشات» (الجولة 3.2): قواعد خالصة مختبَرة. أغلب طلبات براندات إنستجرام تأتي في الرسائل؛
// التاجر يسجلها في متجره ليتابعها مع بقية الطلبات (المخزون، الشحن، التأكيد، التقرير). هنا: مصادر الطلب اليدوي
// وأسماؤها، واستخراج بيانات العميل من رسالة ملصوقة (الرقم، المحافظة، الاسم، العنوان) دون أي تخمين لا تسنده الرسالة.
import { GOVERNORATES } from "@/lib/egypt";
import { normalizeDigits, normalizeEgyptianPhone } from "@/lib/phone";

export const CHAT_SOURCES = ["instagram", "whatsapp", "facebook", "tiktok", "phone", "other"] as const;
export type ChatSource = (typeof CHAT_SOURCES)[number];

export const CHAT_SOURCE_LABEL: Record<ChatSource, string> = {
  instagram: "إنستجرام",
  whatsapp: "واتساب",
  facebook: "فيسبوك",
  tiktok: "تيك توك",
  phone: "مكالمة",
  other: "مصدر آخر",
};

/** قيمة orders.source لطلب يدوي. */
export const manualSource = (s: ChatSource) => `chat:${s}`;

/** اسم مصدر الطلب للعرض («من الشات · إنستجرام»)، أو null لطلب من المتجر نفسه. */
export function chatSourceLabel(source: string | null | undefined): string | null {
  if (!source?.startsWith("chat:")) return null;
  const s = source.slice(5) as ChatSource;
  return CHAT_SOURCE_LABEL[s] ?? CHAT_SOURCE_LABEL.other;
}

/** أسماء بديلة شائعة في الرسائل لكل محافظة (بلا «ال»، وبالعامية والإنجليزية). */
const GOV_ALIASES: Record<string, string[]> = {
  cairo: ["القاهره", "قاهرة", "cairo", "مدينة نصر", "المعادي", "مصر الجديدة", "التجمع", "شبرا", "حلوان", "المقطم", "عين شمس"],
  giza: ["الجيزه", "جيزة", "giza", "6 أكتوبر", "اكتوبر", "أكتوبر", "الشيخ زايد", "زايد", "الهرم", "فيصل", "الدقي", "المهندسين"],
  alexandria: ["اسكندرية", "إسكندرية", "الاسكندرية", "اسكندريه", "alex", "alexandria"],
  qalyubia: ["القليوبيه", "قليوبية", "بنها", "شبرا الخيمة"],
  dakahlia: ["الدقهليه", "المنصورة", "المنصوره"],
  sharqia: ["الشرقيه", "الزقازيق"],
  gharbia: ["الغربيه", "طنطا", "المحلة"],
  monufia: ["المنوفيه", "شبين الكوم"],
  beheira: ["البحيره", "دمنهور"],
  port_said: ["بور سعيد", "بورسعيد"],
  ismailia: ["الاسماعيلية", "اسماعيلية", "الإسماعيليه"],
  red_sea: ["الغردقة", "الغردقه", "hurghada"],
  south_sinai: ["شرم الشيخ", "شرم", "دهب"],
  asyut: ["اسيوط"],
  aswan: ["اسوان"],
  luxor: ["الاقصر"],
};

const norm = (s: string) => s.replace(/[إأآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase();

/** كود المحافظة إن ذُكرت في النص صراحة (أطول تطابق يفوز: «شمال سيناء» قبل «سيناء»). */
export function findGovernorate(text: string): string | null {
  const t = norm(text);
  let best: { code: string; len: number } | null = null;
  for (const g of GOVERNORATES) {
    for (const name of [g.name, ...(GOV_ALIASES[g.code] ?? [])]) {
      const n = norm(name);
      if (n.length >= 3 && t.includes(n) && (!best || n.length > best.len)) best = { code: g.code, len: n.length };
    }
  }
  return best?.code ?? null;
}

export type ChatDetails = { phone: string | null; altPhone: string | null; governorate: string | null; name: string | null; address: string | null };

const LABEL_RE = /^\s*(?:ال)?(?:اسم|الاسم|name|رقم|الرقم|موبايل|الموبايل|تليفون|phone|عنوان|العنوان|address|محافظة|المحافظة)\s*[:：\-–]\s*/i;
const PHONE_CANDIDATE = /(?:\+?2)?0?1[0125][\d\s\-]{8,12}/g;

/**
 * يستخرج من رسالة ملصوقة: أول رقمين مصريين صالحين، والمحافظة إن ذُكرت، والاسم (سطر قصير بلا أرقام موسوم «الاسم:»
 * أو أول سطر كذلك)، والعنوان (سطر موسوم «العنوان:» أو أطول سطر فيه كلمات عنوان/أرقام بعد إزالة الرقم والاسم).
 */
export function parseChatDetails(raw: string): ChatDetails {
  const text = normalizeDigits(raw ?? "").slice(0, 2000);
  const phones: string[] = [];
  for (const m of text.match(PHONE_CANDIDATE) ?? []) {
    const p = normalizeEgyptianPhone(m);
    if (p && !phones.includes(p)) phones.push(p);
  }
  const lines = text
    .split(/\r?\n|[،,](?=\s*(?:العنوان|الاسم|المحافظة|رقم))/)
    .map((l) => l.trim())
    .filter(Boolean);
  const labelled = (re: RegExp) => {
    const l = lines.find((x) => re.test(x));
    return l ? l.replace(LABEL_RE, "").trim() || null : null;
  };
  const stripPhones = (l: string) => l.replace(PHONE_CANDIDATE, "").replace(/\s{2,}/g, " ").trim();

  let name = labelled(/^\s*(?:ال)?(?:اسم|name)\s*[:：\-–]/i);
  if (!name) {
    const cand = lines.map(stripPhones).find((l) => l && !/\d/.test(l) && l.split(/\s+/).length <= 4 && l.length <= 40 && !findGovernorate(l) && !LABEL_RE.test(l));
    name = cand ?? null;
  }
  let address = labelled(/^\s*(?:ال)?(?:عنوان|address)\s*[:：\-–]/i);
  if (!address) {
    const rest = lines
      .map((l) => stripPhones(l.replace(LABEL_RE, "")))
      .filter((l) => l && l !== name && (/\d|شارع|ش\.|عمارة|برج|شقة|الدور|بجوار|امام|أمام|خلف|منطقة|حي/.test(l) || findGovernorate(l)));
    address = rest.sort((a, b) => b.length - a.length)[0] ?? null;
  }
  return {
    phone: phones[0] ?? null,
    altPhone: phones[1] ?? null,
    governorate: findGovernorate(text),
    name: name ? name.slice(0, 60) : null,
    address: address ? address.slice(0, 300) : null,
  };
}
