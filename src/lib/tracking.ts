// tracking.ts — معرّفات التتبع الإعلاني للمتجر (بكسل ميتا، GA4، بكسل تيك توك، تحقق Search Console): تنظيف ما يلصقه التاجر
// والتحقق من صيغته قبل حقنه في صفحات المتجر. منطق خالص مختبَر؛ أي قيمة بصيغة غير صحيحة = لا تُحقن (لا نص حر في سكربت).
export type TrackingIds = { metaPixelId: string | null; gaMeasurementId: string | null; tiktokPixelId: string | null; googleVerification: string | null };

const META = /^\d{10,20}$/;
const GA4 = /^G-[A-Z0-9]{4,15}$/;
const TIKTOK = /^[A-Z0-9]{15,30}$/;
const GVERIFY = /^[A-Za-z0-9_-]{20,100}$/;

/** «fbq('init', '123…')» أو رابط أو رقم بمسافات ← الرقم وحده. */
export function cleanMetaPixel(raw: string | null | undefined): string | null {
  const m = String(raw ?? "").match(/\d{10,20}/);
  return m && META.test(m[0]) ? m[0] : null;
}

export function cleanGa4(raw: string | null | undefined): string | null {
  const m = String(raw ?? "").toUpperCase().match(/G-[A-Z0-9]{4,15}/);
  return m && GA4.test(m[0]) ? m[0] : null;
}

/** «ttq.load('C4ABC…')» أو المعرّف وحده. */
export function cleanTiktokPixel(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  const inLoad = s.match(/load\(\s*['"]([A-Za-z0-9]+)['"]/);
  const v = (inLoad?.[1] ?? s).toUpperCase();
  return TIKTOK.test(v) ? v : null;
}

/** وسم <meta name="google-site-verification" content="…"> كاملاً أو قيمته وحدها. */
export function cleanGoogleVerification(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  const inTag = s.match(/content\s*=\s*["']([^"']+)["']/i);
  const v = (inTag?.[1] ?? s).trim();
  return GVERIFY.test(v) ? v : null;
}

/** رمز Conversions API: سلسلة طويلة بلا مسافات (يبدأ غالباً بـ EAA). */
export function cleanCapiToken(raw: string | null | undefined): string | null {
  const v = String(raw ?? "").trim().replace(/^["']|["']$/g, "");
  return /^[A-Za-z0-9_-]{60,400}$/.test(v) ? v : null;
}

export function trackingFrom(seo: { metaPixelId?: string; gaMeasurementId?: string; tiktokPixelId?: string; googleVerification?: string } | null | undefined): TrackingIds {
  return {
    metaPixelId: cleanMetaPixel(seo?.metaPixelId),
    gaMeasurementId: cleanGa4(seo?.gaMeasurementId),
    tiktokPixelId: cleanTiktokPixel(seo?.tiktokPixelId),
    googleVerification: cleanGoogleVerification(seo?.googleVerification),
  };
}

/** رقم مصري ← صيغة دولية بلا + (201xxxxxxxxx) كما تطلبها ميتا قبل التجزئة. */
export function e164Egypt(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  if (/^01\d{9}$/.test(d)) return `2${d}`;
  if (/^201\d{9}$/.test(d)) return d;
  if (/^00201\d{9}$/.test(d)) return d.slice(2);
  return null;
}
