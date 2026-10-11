// store-preview.ts — معاينة الفريق للمتاجر (بلا اعتماد على Node، يعمل في middleware).
//
// 1) نشرات المعاينة (Vercel Preview لكل فرع، وخادم التطوير): النطاق *.vercel.app لا يحمل اسم متجر، فيُختار
//    المتجر بـ ?store=<slug> (يُحفظ في كوكي للتنقل، و?store=off يلغيه). كل متجر يُفتح هكذا يتجاوز بوابة
//    «قيد التجهيز» لأن المعاينة للفريق فقط.
// 2) نطاق المتجر الحقيقي قبل التسليم: ?preview=<STORE_PREVIEW_KEY> مرة واحدة يحفظ كوكي على هذا النطاق
//    فيرى الفريق المتجر خلف البوابة، والزوار يرون «قيد التجهيز».
// إن ضُبط STORE_PREVIEW_KEY صار شرطاً لنشرات المعاينة أيضاً (?key=...).

export const PREVIEW_STORE_COOKIE = "clp_pv_store";
export const PREVIEW_KEY_COOKIE = "clp_pv_key";
export const PREVIEW_HEADER = "x-store-preview";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
export const isPreviewSlug = (v: string | null | undefined): v is string => Boolean(v && SLUG_RE.test(v));

/** نشرة معاينة أو تطوير (لا الإنتاج). */
export function isPreviewDeployment(env: { VERCEL_ENV?: string; NODE_ENV?: string } = process.env): boolean {
  return env.VERCEL_ENV === "preview" || env.NODE_ENV === "development";
}

/** مقارنة ثابتة الزمن لمفتاح المعاينة. مفتاح غير مضبوط لا يطابق شيئاً. */
export function previewKeyMatches(given: string | null | undefined, expected: string | null | undefined): boolean {
  if (!given || !expected || expected.length < 16) return false;
  let diff = given.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) diff |= (given.charCodeAt(i % Math.max(given.length, 1)) || 0) ^ expected.charCodeAt(i);
  return diff === 0;
}
