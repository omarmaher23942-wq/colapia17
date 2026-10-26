import "server-only";
// cf-bindings.ts — ربط Cloudflare الاختياري لمشروعك: حاوية R2 باسم MEDIA (فيديو واجهة المتجر فقط).
// خارج Cloudflare (التطوير المحلي بلا wrangler) يعيد null فتعمل بقية المتجر كما هي ويظهر سبب غياب رفع الفيديو بوضوح.

/** ما نستخدمه من R2 فقط (بدل حزمة أنواع كاملة). */
export type R2ObjectLike = {
  key: string;
  size: number;
  etag: string;
  httpEtag: string;
  range?: { offset: number; length: number };
  writeHttpMetadata(headers: Headers): void;
  body?: ReadableStream;
};
export type MediaBucket = {
  get(key: string, opts?: { range?: Headers }): Promise<R2ObjectLike | null>;
  put(key: string, value: ArrayBuffer | Uint8Array | ReadableStream, opts?: { httpMetadata?: { contentType?: string; cacheControl?: string } }): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
};

export async function mediaBucket(): Promise<MediaBucket | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const env = (await getCloudflareContext({ async: true })).env as unknown as { MEDIA?: MediaBucket };
    return env.MEDIA ?? null;
  } catch {
    return null;
  }
}
