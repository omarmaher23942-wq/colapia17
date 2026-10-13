import "server-only";
// r2.ts — Cloudflare R2 بواجهة S3 (aws4fetch: توقيع SigV4 يعمل في Node وCloudflare Workers معاً). روابط رفع موقّعة
// قصيرة العمر للمتصفح (النوع والحجم ضمن التوقيع)، وفحص الملف بعد الرفع، ورفع من الخادم، وحذف.
import { AwsClient } from "aws4fetch";
import { env } from "@/lib/env";
import { mediaBaseUrl } from "@/lib/media";

export function r2Configured(): boolean {
  return Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET && mediaBaseUrl());
}

let client: AwsClient | null = null;
function aws(): AwsClient {
  if (!r2Configured()) throw new Error("R2 غير مضبوط (R2_* وNEXT_PUBLIC_MEDIA_BASE_URL)");
  client ??= new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY!, service: "s3", region: "auto" });
  return client;
}

const endpoint = () => (env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
const objectUrl = (key: string) => `${endpoint()}/${env.R2_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;

/** الرابط العام للعرض (نطاق الـ bucket المخصص). */
export function publicUrl(key: string): string {
  return `${mediaBaseUrl()}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** رابط PUT موقّع لعشر دقائق؛ يرفضه R2 إن اختلف النوع أو الحجم عما وُقّع. */
export async function presignPut(key: string, contentType: string, size: number): Promise<{ url: string; headers: Record<string, string> }> {
  const url = new URL(objectUrl(key));
  url.searchParams.set("X-Amz-Expires", "600");
  const headers = { "content-type": contentType, "content-length": String(size) };
  const signed = await aws().sign(new Request(url, { method: "PUT", headers }), { aws: { signQuery: true, allHeaders: true } });
  // المتصفح يضبط content-length بنفسه من حجم الملف؛ نرسل له النوع فقط.
  return { url: signed.url, headers: { "content-type": contentType } };
}

/** بيانات ملف مرفوع (للتحقق بعد الرفع): الحجم والنوع، أو null إن لم يوجد. */
export async function headObject(key: string): Promise<{ size: number; type: string } | null> {
  const r = await aws().fetch(objectUrl(key), { method: "HEAD" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`R2 HEAD ${r.status}`);
  return { size: Number(r.headers.get("content-length") ?? 0), type: r.headers.get("content-type") ?? "" };
}

/** رفع من الخادم (نقل صور خارجية، استيراد). */
export async function putObject(key: string, body: ArrayBuffer | Uint8Array, contentType: string): Promise<string> {
  const r = await aws().fetch(objectUrl(key), { method: "PUT", body: body as BodyInit, headers: { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" } });
  if (!r.ok) throw new Error(`R2 PUT ${r.status}`);
  return publicUrl(key);
}

/** حذف ملفات (خمسة متوازية). مفتاح غير موجود ليس خطأ. */
export async function deleteObjects(keys: string[]): Promise<number> {
  let done = 0;
  for (let i = 0; i < keys.length; i += 5) {
    const rs = await Promise.all(keys.slice(i, i + 5).map((k) => aws().fetch(objectUrl(k), { method: "DELETE" }).catch(() => null)));
    done += rs.filter((r) => r && (r.ok || r.status === 404)).length;
  }
  return done;
}
