import "server-only";
// r2.ts — Cloudflare R2 بواجهة S3 (aws4fetch: توقيع SigV4 يعمل في Node وCloudflare Workers معاً): رفع من الخادم،
// وفحص وجود الملف، وحذف. المتصفح لا يتصل بـ R2 أبداً: يرفع إلى /api/upload ويعرض الملفات من الرابط العام.
import { AwsClient } from "aws4fetch";
import { env } from "@/lib/env";
import { mediaBaseUrl } from "@/lib/media";
import { parseListObjects } from "@/lib/storage-list";

/** أسماء متغيرات R2 الناقصة (فارغة = مضبوطة كلها). الرابط العام له افتراضي media.<النطاق> فلا يُعدّ ناقصاً. */
export function r2Missing(): string[] {
  const need: [string, string | undefined][] = [
    ["R2_ACCOUNT_ID", env.R2_ACCOUNT_ID],
    ["R2_ACCESS_KEY_ID", env.R2_ACCESS_KEY_ID],
    ["R2_SECRET_ACCESS_KEY", env.R2_SECRET_ACCESS_KEY],
    ["R2_BUCKET", env.R2_BUCKET],
  ];
  return need.filter(([, v]) => !v).map(([k]) => k);
}

/** هل R2 هو مساحة الملفات؟ المفاتيح الأربعة مضبوطة ويوجد رابط عام (صريح أو media.<النطاق>). */
export function r2Configured(): boolean {
  return r2Missing().length === 0 && Boolean(mediaBaseUrl());
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

/**
 * مجموع ما في بادئة (مساحة المتجر الفعلية): يمر على ListObjectsV2 صفحةً صفحة (حتى maxPages × 1000 ملف).
 * skip يستبعد مفاتيح لا تُحسب على المتجر. يعيد null إن لم يكن R2 مضبوطاً.
 */
export async function prefixUsage(
  prefix: string,
  skip?: (key: string) => boolean,
  maxPages = 20
): Promise<{ bytes: number; files: number; videos: number; videoBytes: number; complete: boolean } | null> {
  if (!r2Configured()) return null;
  const total = { bytes: 0, files: 0, videos: 0, videoBytes: 0, complete: true };
  let token: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const qs = new URLSearchParams({ "list-type": "2", prefix, "max-keys": "1000" });
    if (token) qs.set("continuation-token", token);
    const r = await aws().fetch(`${endpoint()}/${env.R2_BUCKET}?${qs.toString()}`, { method: "GET" });
    if (!r.ok) throw new Error(`R2 LIST ${r.status}`);
    const p = parseListObjects(await r.text(), skip);
    total.bytes += p.bytes;
    total.files += p.files;
    total.videos += p.videos;
    total.videoBytes += p.videoBytes;
    if (!p.truncated || !p.next) return total;
    token = p.next;
  }
  return { ...total, complete: false };
}
