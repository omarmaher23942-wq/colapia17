import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** دالة تأخير زمني بالمللي ثانية */
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** رابط المتجر العام: https://{sub}.{ROOT}{path}. */
export function storeUrl(subdomain: string, path = "") {
  const suffix = !path ? "" : path.startsWith("/") ? path : `/${path}`;
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const proto = root.includes("localhost") ? "http" : "https";
  return `${proto}://${subdomain}.${root}${suffix}`;
}

/**
 * الرابط العام الأساسي للمتجر (canonical وخريطة الموقع والكتالوج والبيانات المنظمة): نطاقه الخاص متى كان مفعّلاً،
 * وإلا نطاقه الفرعي. النطاق الفرعي لمتجر بنطاق خاص يحوّل إليه (308)، فلا يُفهرس نفس المحتوى برابطين.
 */
export function publicStoreUrl(store: { subdomain: string; customDomain?: string | null; customDomainStatus?: string | null }, path = "") {
  if (store.customDomain && store.customDomainStatus === "active") {
    const suffix = !path ? "" : path.startsWith("/") ? path : `/${path}`;
    return `https://${store.customDomain}${suffix}`;
  }
  return storeUrl(store.subdomain, path);
}

/** نطاق المتجر للعرض فقط (بلا https://). */
export function storeHost(subdomain: string): string {
  try {
    return new URL(storeUrl(subdomain)).host;
  } catch {
    return typeof window !== "undefined" ? window.location.host : subdomain;
  }
}

/**
 * متوسط بايزي للتقييمات: يثبّت المنتجات قليلة المراجعات نحو prior
 * حتى لا يتصدّر منتج بتقييم 5 من مراجعة واحدة قائمة الأكثر مبيعًا.
 */
export function bayesianScore(
  ratingSum: number,
  ratingCount: number,
  prior = 3.5,
  priorWeight = 10
) {
  const v = Math.max(0, ratingCount);
  const R = v > 0 ? ratingSum / v : prior;
  return (v / (v + priorWeight)) * R + (priorWeight / (v + priorWeight)) * prior;
}