// colors.ts — أسماء الألوان كما يكتبها التجار (فصحى وعامية مصرية وإنجليزية) ← hex، مع درجات «فاتح/غامق».
// خالص ومختبَر. يُستخدم في الفهم المباشر للطلبات (parse.ts) ولوصف أي لون بالعربية في ملخص التغيير.
import { hexToHsl, hexToRgb, hslToHex } from "@/blueprint/palette";

type ColorWord = { forms: string[]; hex: string; name: string };

/** كل لون بصيغه: المذكر والمؤنث والعامية والإنجليزية. الترتيب مهم: الأطول والأدق أولاً («أزرق سماوي» قبل «أزرق»). */
export const COLOR_WORDS: ColorWord[] = [
  { forms: ["كحلي", "كحلى", "كحلية", "navy", "نيفي", "نيڤي"], hex: "#1e293b", name: "الكحلي" },
  { forms: ["نبيتي", "نبيتى", "عنابي", "عنابى", "burgundy", "maroon", "wine", "خمري"], hex: "#7a1f3d", name: "العنابي" },
  { forms: ["لبني", "لبنى", "سماوي", "سماوى", "sky", "skyblue", "baby blue"], hex: "#7dd3fc", name: "السماوي" },
  { forms: ["بترولي", "بترولى", "petrol", "teal", "تيل"], hex: "#0f766e", name: "البترولي" },
  { forms: ["تركواز", "تركوازي", "فيروزي", "فيروزى", "turquoise", "cyan"], hex: "#14b8a6", name: "التركوازي" },
  { forms: ["زيتي", "زيتى", "olive"], hex: "#556b2f", name: "الزيتي" },
  { forms: ["مريمي", "sage"], hex: "#87a08b", name: "المريمي" },
  { forms: ["موف", "ليلكي", "lavender", "lilac", "mauve"], hex: "#a78bfa", name: "الموف" },
  { forms: ["بمبي", "بمبى", "زهري", "زهرى", "وردي", "وردى", "pink", "rose"], hex: "#f472b6", name: "الوردي" },
  { forms: ["فوشيا", "فوشي", "fuchsia", "magenta"], hex: "#c026d3", name: "الفوشيا" },
  { forms: ["مرجاني", "مرجانى", "coral"], hex: "#ff6b5b", name: "المرجاني" },
  { forms: ["بيج", "beige", "رملي", "رملى", "sand"], hex: "#e8dcc4", name: "البيج" },
  { forms: ["كريمي", "كريمى", "cream", "قشدي", "اوف وايت", "أوف وايت", "off white", "offwhite"], hex: "#f5efe0", name: "الكريمي" },
  { forms: ["عاجي", "عاجى", "ivory"], hex: "#f8f4e8", name: "العاجي" },
  { forms: ["ذهبي", "ذهبى", "ذهبية", "دهبي", "دهبى", "gold", "golden", "جولد"], hex: "#d4a017", name: "الذهبي" },
  { forms: ["فضي", "فضى", "فضية", "silver"], hex: "#c0c7d3", name: "الفضي" },
  { forms: ["نحاسي", "نحاسى", "برونزي", "copper", "bronze"], hex: "#b87333", name: "النحاسي" },
  { forms: ["رمادي", "رمادى", "رمادية", "رصاصي", "رصاصى", "سكني", "gray", "grey"], hex: "#9ca3af", name: "الرمادي" },
  { forms: ["فحمي", "فحمى", "charcoal"], hex: "#2b2d33", name: "الفحمي" },
  { forms: ["بني", "بنى", "بنية", "قهوة", "قهوي", "شوكولاتة", "brown", "chocolate"], hex: "#7c4a2d", name: "البني" },
  { forms: ["برتقالي", "برتقالى", "برتقاني", "برتقانى", "orange"], hex: "#ea580c", name: "البرتقالي" },
  { forms: ["بنفسجي", "بنفسجى", "أرجواني", "ارجواني", "purple", "violet"], hex: "#7c3aed", name: "البنفسجي" },
  { forms: ["أبيض", "ابيض", "بيضاء", "بيضا", "بيضة", "white"], hex: "#ffffff", name: "الأبيض" },
  { forms: ["أسود", "اسود", "سوداء", "سودا", "black"], hex: "#111111", name: "الأسود" },
  { forms: ["أحمر", "احمر", "حمراء", "حمرا", "red"], hex: "#dc2626", name: "الأحمر" },
  { forms: ["أخضر", "اخضر", "خضراء", "خضرا", "green"], hex: "#166534", name: "الأخضر" },
  { forms: ["أزرق", "ازرق", "زرقاء", "زرقا", "blue"], hex: "#1d4ed8", name: "الأزرق" },
  { forms: ["أصفر", "اصفر", "صفراء", "صفرا", "yellow"], hex: "#eab308", name: "الأصفر" },
];

const AR = "\\u0600-\\u06FF";
// بادئات عربية ملتصقة بالكلمة: و، ب، ل، ال، بال، لل، فال.
const PREFIX = "(?:و)?(?:بال|لل|فال|ال|ل|ب)?";
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LIGHTER = /(فاتح|فاتحة|فاتحه|light|pastel|باستيل|هادي|هادئ)/i;
const DARKER = /(غامق|غامقة|غامقه|داكن|داكنة|داكنه|dark|deep|تقيل|ثقيل)/i;

export type ColorHit = { hex: string; name: string; index: number; end: number };

/** كل الألوان المذكورة في النص بترتيب ورودها (أسماء أو hex)، مع تطبيق «فاتح/غامق» الملاصقة. */
export function colorsIn(text: string): ColorHit[] {
  const hits: ColorHit[] = [];
  const taken: [number, number][] = [];
  const free = (a: number, b: number) => !taken.some(([x, y]) => a < y && b > x);
  for (const m of text.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    const raw = m[1]!.toLowerCase();
    const hex = raw.length === 3 ? `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}` : `#${raw}`;
    const i = m.index ?? 0;
    taken.push([i, i + m[0].length]);
    hits.push({ hex, name: describeColor(hex), index: i, end: i + m[0].length });
  }
  for (const c of COLOR_WORDS) {
    for (const f of [...c.forms].sort((a, b) => b.length - a.length)) {
      const latin = /^[a-z ]+$/i.test(f);
      const re = latin ? new RegExp(`\\b${escapeRe(f)}\\b`, "gi") : new RegExp(`(^|[^${AR}])${PREFIX}(${escapeRe(f)})(?=$|[^${AR}])`, "g");
      for (const m of text.matchAll(re)) {
        const start = (m.index ?? 0) + (latin ? 0 : m[1]!.length);
        const end = (m.index ?? 0) + m[0].length;
        if (!free(start, end)) continue;
        taken.push([start, end]);
        // «فاتح/غامق» بعد اللون مباشرة (حتى كلمتين).
        const tail = text.slice(end, end + 14);
        let hex = c.hex;
        let name = c.name;
        if (LIGHTER.test(tail.split(/\s+/).slice(0, 2).join(" "))) {
          hex = shade(c.hex, +1);
          name = `${c.name} الفاتح`;
        } else if (DARKER.test(tail.split(/\s+/).slice(0, 2).join(" "))) {
          hex = shade(c.hex, -1);
          name = `${c.name} الغامق`;
        }
        hits.push({ hex, name, index: start, end });
      }
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

/** درجة أفتح (+1) أو أغمق (-1) من اللون نفسه. الأبيض والأسود يتحولان إلى رمادي فاتح/فحمي. */
export function shade(hex: string, dir: 1 | -1): string {
  const h = hexToHsl(hex);
  if (dir > 0) return hslToHex({ ...h, l: Math.min(96, h.l + (100 - h.l) * 0.55) });
  return hslToHex({ ...h, l: Math.max(8, h.l * 0.55) });
}

/** أقرب اسم عربي لأي لون (لوصف التغيير للتاجر). */
export function describeColor(hex: string): string {
  const a = hexToRgb(hex);
  let best = COLOR_WORDS[0]!;
  let bd = Infinity;
  for (const n of COLOR_WORDS) {
    const b = hexToRgb(n.hex);
    const d = (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best.name;
}
