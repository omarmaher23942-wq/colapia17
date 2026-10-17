// media.ts — مساحة ملفات Colapia: من يرفع ماذا وبأي حدود، ومن أين تُقبل روابط الملفات. منطق خالص يستخدمه المتصفح
// والخادم. الرفع يمر دائماً بالخادم (app/api/upload) الذي يكتب في R2 متى ضُبطت مفاتيحه وإلا في UploadThing، فلا
// قرار وقت بناء ولا رفع مباشر من المتصفح. الملفات القديمة على UploadThing تبقى مقبولة ومعروضة.

export const MEDIA_ROUTES = {
  productImage: { maxBytes: 8 << 20, maxFiles: 10 },
  brandAsset: { maxBytes: 4 << 20, maxFiles: 1 },
  platformReceipt: { maxBytes: 8 << 20, maxFiles: 1 },
  transferProof: { maxBytes: 8 << 20, maxFiles: 1 },
  customerReviewImage: { maxBytes: 4 << 20, maxFiles: 3 },
  merchantAvatar: { maxBytes: 4 << 20, maxFiles: 1 },
  // بحث العميل بالصورة في المتجر (لا يُحفظ في أي جدول، ويُحذف بعد المطابقة).
  visualSearch: { maxBytes: 4 << 20, maxFiles: 1 },
} as const satisfies Record<string, { maxBytes: number; maxFiles: number }>;

export type MediaRoute = keyof typeof MEDIA_ROUTES;
export const isMediaRoute = (r: unknown): r is MediaRoute => typeof r === "string" && Object.hasOwn(MEDIA_ROUTES, r);

// لا SVG (سكربت داخل صورة) ولا HEIC ولا أي image/* غير مألوف.
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "image/gif": "gif" };

/** النوع بلا معاملات (image/jpeg;charset=… ← image/jpeg) بحروف صغيرة. */
export const baseType = (t: string) => t.split(";")[0]!.trim().toLowerCase();

/** امتداد الملف للنوع المسموح، أو null إن كان النوع مرفوضاً. */
export function extensionFor(type: string): string | null {
  return IMAGE_TYPES[baseType(type)] ?? null;
}

/** النوع الحقيقي للصورة من بايتاتها الأولى (لا نثق بنوع يعلنه المتصفح)، أو null إن لم تكن صيغة مقبولة. */
export function sniffImageType(b: Uint8Array): string | null {
  const at = (i: number, s: string) => s.split("").every((c, k) => b[i + k] === c.charCodeAt(0));
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && at(1, "PNG") && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 6 && (at(0, "GIF87a") || at(0, "GIF89a"))) return "image/gif";
  if (b.length >= 12 && at(0, "RIFF") && at(8, "WEBP")) return "image/webp";
  if (b.length >= 12 && at(4, "ftyp") && (at(8, "avif") || at(8, "avis"))) return "image/avif";
  return null;
}

/** HEIC/HEIF (صور آيفون القديمة): يرفضها الخادم برسالة خاصة بدل «ليست صورة». */
export function looksHeic(b: Uint8Array): boolean {
  const at = (i: number, s: string) => s.split("").every((c, k) => b[i + k] === c.charCodeAt(0));
  return b.length >= 12 && at(4, "ftyp") && ["heic", "heix", "hevc", "mif1", "msf1"].some((s) => at(8, s));
}

const rootDomain = (): string | null => {
  const d = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || process.env.ROOT_DOMAIN || "").trim().toLowerCase();
  return d && !d.startsWith("localhost") && !/^\d+\.\d+\.\d+\.\d+/.test(d) ? d : null;
};

/**
 * الرابط العام لمساحة R2: القيمة الصريحة (MEDIA_BASE_URL أو NEXT_PUBLIC_MEDIA_BASE_URL) وإلا media.<النطاق الرئيسي>.
 * الافتراضي يغني عن ضبط المتغير، ويخدمه الـ Worker نفسه من R2 (cloudflare/media.ts) فلا يلزم ربط نطاق على الـ bucket.
 */
export function mediaBaseUrl(): string | null {
  const raw = (process.env.MEDIA_BASE_URL || process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "").trim();
  if (raw) {
    try {
      const u = new URL(raw);
      return u.protocol === "https:" || u.hostname === "localhost" ? u.origin : null;
    } catch {
      return null;
    }
  }
  const root = rootDomain();
  return root ? `https://media.${root}` : null;
}

const UT_HOST = /^(?:utfs\.io|[a-z0-9-]+\.ufs\.sh)$/i;

/** هل المضيف مساحة ملفاتنا (R2 أو UploadThing)؟ */
export function isMediaHost(hostname: string): boolean {
  if (UT_HOST.test(hostname)) return true;
  const base = mediaBaseUrl();
  return Boolean(base && new URL(base).hostname === hostname.toLowerCase());
}

/** مفتاح الملف في R2 من رابطه العام، أو null إن لم يكن رابطاً من مساحتنا على R2. */
export function r2KeyFromUrl(url: string): string | null {
  const base = mediaBaseUrl();
  if (!base) return null;
  try {
    const u = new URL(url);
    if (u.origin !== base) return null;
    const key = decodeURIComponent(u.pathname.replace(/^\/+/, ""));
    return /^[a-z0-9][a-z0-9/_.-]{3,200}$/i.test(key) && !key.includes("..") ? key : null;
  } catch {
    return null;
  }
}
