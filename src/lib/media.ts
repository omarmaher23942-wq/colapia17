// media.ts — مساحة ملفات Colapia: من يرفع ماذا وبأي حدود، ومن أين تُقبل روابط الملفات. منطق خالص يستخدمه المتصفح
// والخادم. المزوّد: R2 (Cloudflare، رفع مباشر من المتصفح بروابط موقّعة) متى ضُبط NEXT_PUBLIC_MEDIA_PROVIDER=r2،
// وإلا UploadThing كما كان (للانتقال بلا توقف). الملفات القديمة على UploadThing تبقى مقبولة ومعروضة.

export const MEDIA_ROUTES = {
  productImage: { kind: "image", maxBytes: 8 << 20, maxFiles: 10 },
  brandAsset: { kind: "image", maxBytes: 4 << 20, maxFiles: 1 },
  platformReceipt: { kind: "image", maxBytes: 8 << 20, maxFiles: 1 },
  transferProof: { kind: "image", maxBytes: 8 << 20, maxFiles: 1 },
  customerReviewImage: { kind: "image", maxBytes: 4 << 20, maxFiles: 3 },
  merchantAvatar: { kind: "image", maxBytes: 4 << 20, maxFiles: 1 },
  intakeImage: { kind: "image", maxBytes: 8 << 20, maxFiles: 1 },
  intakeVoice: { kind: "audio", maxBytes: 8 << 20, maxFiles: 1 },
  // بحث العميل بالصورة في المتجر (لا يُحفظ في أي جدول، ويُحذف بعد المطابقة).
  visualSearch: { kind: "image", maxBytes: 4 << 20, maxFiles: 1 },
} as const satisfies Record<string, { kind: "image" | "audio"; maxBytes: number; maxFiles: number }>;

export type MediaRoute = keyof typeof MEDIA_ROUTES;
export const isMediaRoute = (r: unknown): r is MediaRoute => typeof r === "string" && Object.hasOwn(MEDIA_ROUTES, r);

// لا SVG (سكربت داخل صورة) ولا أي image/* غير مألوف.
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "image/gif": "gif" };
const AUDIO_TYPES: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
};

/** النوع بلا معاملات (audio/webm;codecs=opus ← audio/webm) بحروف صغيرة. */
export const baseType = (t: string) => t.split(";")[0]!.trim().toLowerCase();

/** امتداد الملف للنوع المسموح في هذا المسار، أو null إن كان النوع مرفوضاً. */
export function extensionFor(route: MediaRoute, type: string): string | null {
  const t = baseType(type);
  return (MEDIA_ROUTES[route].kind === "audio" ? AUDIO_TYPES[t] : IMAGE_TYPES[t]) ?? null;
}

/** مزوّد الرفع الحالي (يُثبَّت وقت البناء في المتصفح). */
export const MEDIA_PROVIDER: "r2" | "uploadthing" = process.env.NEXT_PUBLIC_MEDIA_PROVIDER === "r2" ? "r2" : "uploadthing";

/** الرابط العام لمساحة R2 (نطاق مخصص على الـ bucket، مثل https://media.colapia.com). */
export function mediaBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_MEDIA_BASE_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.hostname === "localhost" ? u.origin : null;
  } catch {
    return null;
  }
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
