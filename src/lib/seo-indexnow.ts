// seo-indexnow.ts — إخطار محركات البحث (Bing وYandex وغيرهما ممن يدعم IndexNow) بالروابط الجديدة والمعدّلة فور نشرها (منطق مختبَر).
// معطّل افتراضياً (لا يفعل شيئاً بلا إعداد): يعمل بأحد أمرين فقط في بيئة التشغيل:
//   INDEXNOW_KEY      مفتاح ثابت (8–128 حرفاً من الحروف اللاتينية والأرقام والشرطة) لمشروع متجر واحد.
//   INDEXNOW_ENABLED=1  مع AUTH_SECRET: مفتاح مشتق لكل متجر (يلزم حين تخدم النسخة عدة متاجر).
// ملف المفتاح يُخدم من /indexnow-key.txt على نطاق المتجر (app/s/[store]/indexnow-key.txt). جوجل لا يدعم IndexNow؛ يقرأ خريطة الموقع.

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_KEY_PATH = "/indexnow-key.txt";
const MAX_URLS = 10_000;

export type IndexNowEnv = Record<string, string | undefined>;

export const isValidIndexNowKey = (k: string | undefined | null): k is string => !!k && /^[A-Za-z0-9-]{8,128}$/.test(k);

/** مفتاح مشتق من السر ومعرّف المتجر (HMAC-SHA256، 32 خانة): ثابت ولا يُخزَّن. */
export async function deriveIndexNowKey(secret: string, storeId: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`indexnow:${storeId}`)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/** مفتاح المتجر إن كانت الميزة مفعّلة، وإلا null (فلا طلبات ولا ملف مفتاح). */
export async function indexNowKeyFor(storeId: string, env: IndexNowEnv = process.env): Promise<string | null> {
  if (env.INDEXNOW_KEY) return isValidIndexNowKey(env.INDEXNOW_KEY) ? env.INDEXNOW_KEY : null;
  if (env.INDEXNOW_ENABLED === "1" && env.AUTH_SECRET) return deriveIndexNowKey(env.AUTH_SECRET, storeId);
  return null;
}

/** جسم الطلب: روابط مطلقة من المضيف نفسه فقط (يرفضها IndexNow غير ذلك)، بلا تكرار، وبحد الطلب الواحد. */
export function indexNowBody(opts: { host: string; key: string; urls: string[] }) {
  const urls = [...new Set(opts.urls)].filter((u) => {
    try {
      const x = new URL(u);
      return x.protocol === "https:" && x.host === opts.host;
    } catch {
      return false;
    }
  });
  return {
    host: opts.host,
    key: opts.key,
    keyLocation: `https://${opts.host}${INDEXNOW_KEY_PATH}`,
    urlList: urls.slice(0, MAX_URLS),
  };
}

export type IndexNowResult = { sent: boolean; reason?: "disabled" | "no_urls" | "failed"; status?: number };

/** يرسل الروابط؛ لا يرمي أبداً (فشل الإخطار لا يفشل حفظ المنتج). */
export async function submitIndexNow(opts: { storeId: string; host: string; urls: string[]; env?: IndexNowEnv; fetcher?: typeof fetch }): Promise<IndexNowResult> {
  const key = await indexNowKeyFor(opts.storeId, opts.env);
  if (!key) return { sent: false, reason: "disabled" };
  const body = indexNowBody({ host: opts.host, key, urls: opts.urls });
  if (!body.urlList.length) return { sent: false, reason: "no_urls" };
  try {
    const res = await (opts.fetcher ?? fetch)(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok || res.status === 202 ? { sent: true, status: res.status } : { sent: false, reason: "failed", status: res.status };
  } catch {
    return { sent: false, reason: "failed" };
  }
}
