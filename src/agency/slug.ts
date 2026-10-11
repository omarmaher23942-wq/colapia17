// slug.ts — اقتراح النطاق الفرعي لمتجر جديد من بيانات الطلب (منطق خالص). الفريق يراجعه ويعدّله قبل التجهيز.
// الترتيب: اسم حساب إنستجرام/فيسبوك (غالباً هو اسم العلامة باللاتينية) ← الاسم إن كان لاتينياً ← نقحرة الاسم العربي
// ← «store-<رقم الطلب>».
import { isValidSubdomain } from "@/lib/subdomains";

const AR: Record<string, string> = {
  ا: "a", أ: "a", إ: "e", آ: "a", ٱ: "a", ب: "b", ت: "t", ث: "th", ج: "g", ح: "h", خ: "kh", د: "d", ذ: "z", ر: "r",
  ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "k", ك: "k", ل: "l", م: "m",
  ن: "n", ه: "h", ة: "a", و: "o", ؤ: "o", ي: "y", ى: "a", ئ: "e", ء: "",
};
const DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** يحوّل نصاً (عربياً أو لاتينياً) إلى صيغة نطاق فرعي، أو null إن لم يبقَ ما يكفي. */
export function toSlug(raw: string): string | null {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/^(ال)(?=\S{3,})/u, "el-")
    .split("")
    .map((ch) => {
      const d = DIGITS.indexOf(ch);
      if (d >= 0) return String(d);
      if (ch in AR) return AR[ch];
      return ch;
    })
    .join("")
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30)
    .replace(/-$/g, "");
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

export function suggestSlug(input: { storeName?: string | null; socialUrl?: string | null; code: string }, taken: (s: string) => boolean = () => false): string {
  const fromCode = `store-${input.code.replace(/\D/g, "").slice(-6) || "new"}`;
  const candidates = [handleFromSocial(input.socialUrl), input.storeName].map((c) => (c ? toSlug(c) : null)).filter((c): c is string => Boolean(c));
  for (const c of [...candidates, fromCode]) {
    if (!isValidSubdomain(c)) continue;
    if (!taken(c)) return c;
    for (let i = 2; i < 20; i++) {
      const alt = `${c.slice(0, 27)}-${i}`;
      if (isValidSubdomain(alt) && !taken(alt)) return alt;
    }
  }
  return fromCode;
}
