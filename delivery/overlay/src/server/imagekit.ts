import "server-only";
// imagekit.ts — رفع الصور وحذفها على حساب ImageKit الخاص بك (المفتاح الخاص من متغيرات Cloudflare، لا يصل المتصفح أبداً).
// العرض بتحويلات في الرابط نفسه (src/lib/image-loader.ts): الحجم والجودة والصيغة تُحدَّد وقت العرض.

export type ImageKitConfig = { privateKey: string; urlEndpoint: string };

/** نقطة النهاية العامة (مثل https://ik.imagekit.io/your_id): من IMAGEKIT_URL_ENDPOINT. */
export function imagekitConfig(): ImageKitConfig | null {
  const privateKey = (process.env.IMAGEKIT_PRIVATE_KEY ?? "").trim();
  const urlEndpoint = (process.env.IMAGEKIT_URL_ENDPOINT ?? process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ?? "").trim().replace(/\/+$/, "");
  if (!privateKey || !/^https:\/\/[^/]+/.test(urlEndpoint)) return null;
  return { privateKey, urlEndpoint };
}

/** أسماء المتغيرات الناقصة (لصفحة الإعداد). */
export function imagekitMissing(): string[] {
  const out: string[] = [];
  if (!(process.env.IMAGEKIT_PRIVATE_KEY ?? "").trim()) out.push("IMAGEKIT_PRIVATE_KEY");
  if (!/^https:\/\/[^/]+/.test((process.env.IMAGEKIT_URL_ENDPOINT ?? process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ?? "").trim())) out.push("IMAGEKIT_URL_ENDPOINT");
  return out;
}

const auth = (privateKey: string) => `Basic ${btoa(`${privateKey}:`)}`;

export type UploadedImage = { url: string; fileId: string };

export async function uploadToImageKit(file: { bytes: Uint8Array; name: string; type: string; folder: string }): Promise<UploadedImage | null> {
  const cfg = imagekitConfig();
  if (!cfg) return null;
  const fd = new FormData();
  fd.set("file", new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: file.type }), file.name);
  fd.set("fileName", file.name);
  fd.set("folder", `/${file.folder.replace(/^\/+|\/+$/g, "")}`);
  fd.set("useUniqueFileName", "true");
  try {
    const r = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", headers: { Authorization: auth(cfg.privateKey) }, body: fd, signal: AbortSignal.timeout(30_000) });
    if (!r.ok) {
      console.error("[imagekit] upload failed", r.status, (await r.text().catch(() => "")).slice(0, 200));
      return null;
    }
    const j = (await r.json()) as { url?: string; fileId?: string };
    return j.url && j.fileId ? { url: j.url, fileId: j.fileId } : null;
  } catch (e) {
    console.error("[imagekit] upload error", e);
    return null;
  }
}

/** يحذف ملفاً؛ حذف ملف غير موجود نجاح. */
export async function deleteFromImageKit(fileId: string): Promise<boolean> {
  const cfg = imagekitConfig();
  if (!cfg) return false;
  try {
    const r = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, { method: "DELETE", headers: { Authorization: auth(cfg.privateKey) }, signal: AbortSignal.timeout(15_000) });
    return r.ok || r.status === 404;
  } catch {
    return false;
  }
}

/** اختبار حي لمفاتيح ImageKit (قراءة قائمة ملفات بحد 1). */
export async function checkImageKit(): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = imagekitConfig();
  if (!cfg) return { ok: false, error: `ناقص: ${imagekitMissing().join("، ")}` };
  try {
    const r = await fetch("https://api.imagekit.io/v1/files?limit=1", { headers: { Authorization: auth(cfg.privateKey) }, signal: AbortSignal.timeout(10_000) });
    if (r.status === 401 || r.status === 403) return { ok: false, error: "ImageKit رفض المفتاح الخاص (IMAGEKIT_PRIVATE_KEY). تأكدوا أنه نُسخ كاملاً من صفحة API Keys." };
    return r.ok ? { ok: true } : { ok: false, error: `ImageKit ردّ برمز ${r.status}.` };
  } catch {
    return { ok: false, error: "تعذّر الاتصال بـ ImageKit الآن. أعيدوا المحاولة بعد دقيقة." };
  }
}
