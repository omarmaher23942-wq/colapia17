// media-host.ts (مشروعك الخاص) — مساحة الملفات التي يكتب فيها الخادم: الصور على حساب ImageKit الخاص بك، وفيديو الواجهة على
// حاوية R2 (ربط MEDIA) ويُخدم من /media/... بنفس الموقع. نفس واجهة نسخة المنصة (upload/remove).
// مفتاح الملف يحمل مصدره: «ik:<fileId>» لصورة، و«r2:<مسار>» لفيديو، فيعرف الحذف أين يذهب.
import "server-only";
import { randomUUID } from "node:crypto";
import { deleteFromImageKit, imagekitConfig, uploadToImageKit } from "@/server/imagekit";
import { mediaBucket } from "@/server/cf-bindings";

export type MediaHost = {
  /** يرفع ملفاً ويعيد رابطه العام ومفتاحه، أو null عند الفشل. */
  upload(file: { bytes: Uint8Array; name: string; type: string; ext: string; prefix: string }): Promise<{ url: string; key: string } | null>;
  /** يحذف الملفات؛ true فقط إن نجح الحذف كله (مفتاح محذوف سابقاً نجاح). */
  remove(keys: string[]): Promise<boolean>;
};

/** هل يمكن رفع الصور؟ (ImageKit مضبوط). */
export const imagesConfigured = () => Boolean(imagekitConfig());

export async function mediaApi(): Promise<MediaHost | null> {
  const bucket = await mediaBucket();
  if (!imagekitConfig() && !bucket) return null;
  return {
    async upload(f) {
      if (f.type.startsWith("video/")) {
        if (!bucket) return null;
        const key = `${f.prefix.replace(/^stores\/[^/]+\//, "")}/${randomUUID()}.${f.ext}`;
        try {
          await bucket.put(key, f.bytes, { httpMetadata: { contentType: f.type, cacheControl: "public, max-age=31536000, immutable" } });
          return { url: `/media/${key}`, key: `r2:${key}` };
        } catch (e) {
          console.error("[media-host] r2 put failed", e);
          return null;
        }
      }
      const up = await uploadToImageKit({ bytes: f.bytes, name: f.name, type: f.type, folder: f.prefix });
      return up ? { url: up.url, key: `ik:${up.fileId}` } : null;
    },
    async remove(keys) {
      let ok = true;
      for (const k of keys) {
        if (k.startsWith("r2:")) {
          if (!bucket) ok = false;
          else await bucket.delete(k.slice(3)).catch(() => (ok = false));
        } else if (k.startsWith("ik:")) {
          if (!(await deleteFromImageKit(k.slice(3)))) ok = false;
        }
      }
      return ok;
    },
  };
}
