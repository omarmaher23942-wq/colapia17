// slug.ts — اقتراح النطاق الفرعي لمتجر جديد (منطق خالص ومختبَر).
// الترتيب (قرار المالك V3): **اسم المتجر** (اللاتيني كما هو، والعربي بنقحرة مقروءة) ← اسم حساب إنستجرام ← «store-<رقم>».
// **لا يُشتق من البريد أبداً**: أي مرشح يطابق الجزء المحلي من بريد التاجر يُستبعد، لأن حساب إنستجرام الذي يراسلنا
// كثيراً ما يكون الحساب الشخصي لصاحب البراند (بنفس اسم بريده) لا حساب البراند، فيخرج نطاق باسم الشخص لا المتجر.
import { isValidSubdomain } from "@/lib/subdomains";

// نقحرة حرف بحرف. الواو والياء في وسط الكلمة حرفا مد غالباً (نور ← nour، سيف ← seif)، وفي أولها حرفان ساكنان.
const AR: Record<string, string> = {
  ا: "a", أ: "a", إ: "e", آ: "a", ٱ: "a", ب: "b", ت: "t", ث: "th", ج: "g", ح: "h", خ: "kh", د: "d", ذ: "z", ر: "r",
  ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "k", ك: "k", ل: "l", م: "m",
  ن: "n", ه: "h", ة: "a", و: "w", ؤ: "o", ي: "y", ى: "a", ئ: "e", ء: "",
};
const MID_VOWEL: Record<string, string> = { و: "ou", ي: "i" };
const DIGITS = "٠١٢٣٤٥٦٧٨٩";

// كلمات شائعة في أسماء المتاجر تُكتب بمعناها المعروف لا بنقحرتها (للملابس ← wear بدل llmlabs).
const WORDS: Record<string, string> = {
  ملابس: "wear", ازياء: "fashion", أزياء: "fashion", موضة: "fashion", احذية: "shoes", أحذية: "shoes", شوز: "shoes",
  عطور: "perfumes", برفان: "parfum", برفيوم: "perfume", اكسسوارات: "accessories", إكسسوارات: "accessories",
  الكترونيات: "electronics", إلكترونيات: "electronics", موبايلات: "mobiles", هواتف: "phones", ساعات: "watches",
  شنط: "bags", حقائب: "bags", مجوهرات: "jewelry", ذهب: "gold", فضة: "silver", تجميل: "beauty", بيوتي: "beauty",
  اطفال: "kids", أطفال: "kids", كيدز: "kids", بيبي: "baby", هوم: "home", منزل: "home", ديكور: "decor", مفروشات: "home",
  حلويات: "sweets", قهوة: "coffee", كافيه: "cafe", مخبوزات: "bakery", عسل: "honey",
  ستور: "store", متجر: "store", شوب: "shop", محل: "shop", براند: "brand", جاليري: "gallery", بوتيك: "boutique",
  هاوس: "house", كولكشن: "collection", ستوديو: "studio", ستايل: "style",
};
/** يجرد الكلمة من «ال» و«لل» و«و» الملتصقة في أولها ليطابقها القاموس (للملابس ← ملابس). */
function bareArabic(word: string): string[] {
  const out = [word];
  for (const p of ["وال", "بال", "لل", "ال", "و", "ب", "ل"]) if (word.startsWith(p) && word.length - p.length >= 3) out.push(word.slice(p.length));
  return out;
}

function translitWord(word: string): string {
  if (!/[؀-ۿ]/.test(word)) return word;
  for (const w of bareArabic(word)) if (WORDS[w]) return WORDS[w];
  let w = word;
  let prefix = "";
  if (/^ال\S{2,}/u.test(w)) {
    prefix = "el-";
    w = w.slice(2);
  }
  const chars = [...w];
  const out = chars.map((ch, i) => {
    const d = DIGITS.indexOf(ch);
    if (d >= 0) return String(d);
    if (i > 0 && i < chars.length - 1 && MID_VOWEL[ch]) return MID_VOWEL[ch];
    if (i === chars.length - 1 && i > 0 && ch === "ي") return "y";
    if (i === chars.length - 1 && i > 0 && ch === "و") return "o";
    return AR[ch] ?? ch;
  });
  return prefix + out.join("");
}

/** يحوّل نصاً (عربياً أو لاتينياً) إلى صيغة نطاق فرعي، أو null إن لم يبقَ ما يكفي. */
export function toSlug(raw: string): string | null {
  const words = raw
    .trim()
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "") // التشكيل والتطويل
    .split(/[\s_.\-/|·,،&+]+/)
    .filter(Boolean)
    .map(translitWord);
  const clean = (ws: string[]) =>
    ws
      .join("-")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  let s = clean(words);
  s = s.slice(0, 30).replace(/-[^-]{0,1}$/, "").replace(/-$/g, "");
  return s.length >= 3 ? s : null;
}

/** اسم الحساب من رابط إنستجرام/فيسبوك/تيك توك (بلا المسارات العامة). */
export function handleFromSocial(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const first = u.pathname.split("/").filter(Boolean)[0] ?? "";
    const h = first.replace(/^@/, "");
    if (!h || ["p", "reel", "reels", "stories", "profile.php", "pages", "people", "groups", "share"].includes(h.toLowerCase())) return null;
    return h;
  } catch {
    return null;
  }
}

/** الجزء المحلي من بريد بصيغة النطاق (للاستبعاد): omar.maher+x@gmail.com ← omarmaher و omar-maher. */
export function emailLocalSlugs(email: string | null | undefined): string[] {
  const local = (email ?? "").trim().toLowerCase().split("@")[0]?.split("+")[0] ?? "";
  if (!local) return [];
  const dashed = local.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return [...new Set([dashed, local.replace(/[^a-z0-9]/g, "")].filter((s) => s.length >= 3))];
}

/** هل يبدو المرشح مأخوذاً من البريد (مطابقاً لجزئه المحلي أو بفروق شرطات وأرقام لاحقة فقط)؟ */
export function looksLikeEmail(candidate: string, avoid: string[]): boolean {
  if (!avoid.length) return false;
  const flat = candidate.replace(/-/g, "");
  const flatNoDigits = flat.replace(/\d+$/, "");
  return avoid.some((a) => {
    const fa = a.replace(/-/g, "");
    return fa === flat || (flatNoDigits.length >= 4 && fa.replace(/\d+$/, "") === flatNoDigits);
  });
}

export function suggestSlug(
  input: { storeName?: string | null; socialUrl?: string | null; email?: string | null; code: string },
  taken: (s: string) => boolean = () => false
): string {
  const fromCode = `store-${input.code.replace(/\D/g, "").slice(-6) || "new"}`;
  const avoid = emailLocalSlugs(input.email);
  const candidates = [input.storeName, handleFromSocial(input.socialUrl)]
    .map((c) => (c ? toSlug(c) : null))
    .filter((c): c is string => Boolean(c) && !looksLikeEmail(c!, avoid));
  for (const c of [...new Set(candidates), fromCode]) {
    if (!isValidSubdomain(c)) continue;
    if (!taken(c)) return c;
    for (let i = 2; i < 20; i++) {
      const alt = `${c.slice(0, 27).replace(/-$/, "")}-${i}`;
      if (isValidSubdomain(alt) && !taken(alt)) return alt;
    }
  }
  return fromCode;
}
