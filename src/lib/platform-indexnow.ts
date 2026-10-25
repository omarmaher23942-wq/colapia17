// platform-indexnow.ts — إشعار محركات البحث (Bing وYandex وغيرهما عبر IndexNow) بتغيّر صفحات المنصة فور نشرها.
// المفتاح عام بتصميم البروتوكول: ملفه public/<المفتاح>.txt على جذر النطاق، فلا سرّ هنا.
// الاستخدام اليدوي بعد النشر: npx tsx scripts/seo/indexnow-ping.ts
import { INDEXNOW_KEY, platformSitemap, siteOrigin } from "@/lib/platform-seo";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export type IndexNowPayload = { host: string; key: string; keyLocation: string; urlList: string[] };

/** يبني حمولة الطلب: روابط https من النطاق نفسه فقط، بلا تكرار، وبحد البروتوكول (10,000). */
export function indexNowPayload(origin: string, urls: string[], key = INDEXNOW_KEY): IndexNowPayload {
  const base = new URL(origin);
  const list = [...new Set(urls)].filter((u) => {
    try {
      const x = new URL(u);
      return x.host === base.host && x.protocol === base.protocol;
    } catch {
      return false;
    }
  });
  return { host: base.host, key, keyLocation: `${base.origin}/${key}.txt`, urlList: list.slice(0, 10_000) };
}

/** صفحات المنصة المفهرسة (من خريطة الموقع نفسها). */
export const platformIndexNowUrls = (origin = siteOrigin()) => platformSitemap(origin).map((e) => e.url);

/** يرسل الإشعار. localhost لا يُرسل أبداً. النتيجة 200/202 = قُبل. */
export async function pingIndexNow(origin = siteOrigin(), urls: string[] = platformIndexNowUrls(origin)): Promise<{ ok: boolean; status: number; submitted: number }> {
  if (/localhost|127\.0\.0\.1/.test(origin)) return { ok: false, status: 0, submitted: 0 };
  const body = indexNowPayload(origin, urls);
  if (!body.urlList.length) return { ok: false, status: 0, submitted: 0 };
  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  return { ok: !!res && (res.status === 200 || res.status === 202), status: res?.status ?? 0, submitted: body.urlList.length };
}
