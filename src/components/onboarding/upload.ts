"use client";
// upload.ts — رفع الصور من الإعداد واللوحة: تصحيح/قص اختياري، ضغط، ثم رفع بثلاث متوازية عبر المسار الموحد.
// الصور الشفافة (شعار PNG أو منتج أُزيلت خلفيته) تبقى شفافة: لا تُحوَّل إلى JPEG (كان يسوّد الخلفية).
import imageCompression from "browser-image-compression";
import { cleanupImage } from "@/lib/image-prep";
import { uploadMany } from "@/lib/media-upload";
import type { MediaRoute } from "@/lib/media";

let webpOk: boolean | null = null;
/** هل يكتب متصفح الجهاز WebP من canvas؟ (Safari القديم لا). */
function canEncodeWebp(): boolean {
  if (webpOk !== null) return webpOk;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    webpOk = c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    webpOk = false;
  }
  return webpOk;
}

/** هل في الصورة بكسلات شفافة؟ (عينات على صورة مصغّرة: سريع). JPEG لا شفافية فيه أبداً. */
export async function hasTransparency(f: Blob): Promise<boolean> {
  if (f.type === "image/jpeg") return false;
  try {
    const bmp = await createImageBitmap(f);
    const w = Math.min(96, bmp.width);
    const h = Math.max(1, Math.round((w * bmp.height) / Math.max(1, bmp.width)));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const d = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < d.length; i += 4) if (d[i]! < 250) return true;
    return false;
  } catch {
    return false;
  }
}

const base = (name: string) => name.replace(/\.\w+$/, "") || "image";

async function prep(f: File, opts: { cleanup: boolean; keepAlpha: boolean }): Promise<File> {
  let file = f;
  const alpha = opts.keepAlpha && (await hasTransparency(f));
  // التنظيف يضع المنتج على خلفية فاتحة: لا معنى له لصورة شفافة.
  if (opts.cleanup && !alpha) file = await cleanupImage(file);
  try {
    const type = alpha ? (canEncodeWebp() ? "image/webp" : "image/png") : "image/jpeg";
    const c = await imageCompression(file, { maxSizeMB: alpha ? 2 : 1.2, maxWidthOrHeight: 2000, useWebWorker: false, initialQuality: 0.88, fileType: type });
    const ext = type === "image/webp" ? "webp" : type === "image/png" ? "png" : "jpg";
    return new File([c], `${base(file.name)}.${ext}`, { type });
  } catch {
    return file;
  }
}

/** يجهّز ويرفع الصور مع تقدم؛ يعيد الروابط بترتيب الملفات (ما فشل يُحذف) وأول رسالة خطأ إن وُجدت. */
export async function uploadImages(
  files: File[],
  opts: { cleanup?: boolean; keepAlpha?: boolean; route?: MediaRoute; onProgress?: (done: number, total: number) => void } = {}
): Promise<{ urls: string[]; error: string | null }> {
  const route = opts.route ?? "productImage";
  const keepAlpha = opts.keepAlpha ?? true;
  const urls: string[] = [];
  let error: string | null = null;
  let done = 0;
  // دفعات من 3: تحضير الصور في المتصفح أثقل من الرفع نفسه.
  for (let i = 0; i < files.length; i += 3) {
    const batch = files.slice(i, i + 3);
    const prepared = await Promise.all(batch.map((f) => prep(f, { cleanup: Boolean(opts.cleanup), keepAlpha })));
    const r = await uploadMany(route, prepared);
    urls.push(...r.done.map((d) => d.url));
    error ??= r.error;
    done += batch.length;
    opts.onProgress?.(done, files.length);
  }
  return { urls, error };
}

/** يجهّز صورة واحدة ويرفعها (للرفع المجمّع بتقدم لكل صورة). يرمي Error برسالة عربية عند الفشل. */
export async function uploadOneImage(file: File, opts: { cleanup?: boolean; route?: MediaRoute } = {}): Promise<string> {
  const prepared = await prep(file, { cleanup: Boolean(opts.cleanup), keepAlpha: true });
  const r = await uploadMany(opts.route ?? "productImage", [prepared]);
  const url = r.done[0]?.url;
  if (!url) throw new Error(r.error ?? "تعذر رفع الصورة. حاولوا مرة أخرى.");
  return url;
}

export type VideoProbe = { ok: true; poster: File | null; width: number; height: number; duration: number } | { ok: false; error: string };

/**
 * يتحقق أن متصفح الجهاز يستطيع تشغيل الفيديو (فيديو آيفون بترميز HEVC مثلاً لا يعمل في كثير من المتصفحات)
 * ويلتقط صورة غلاف من لقطة مبكرة لتظهر الواجهة فوراً قبل تحميل الفيديو.
 */
export async function probeVideo(file: File): Promise<VideoProbe> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.crossOrigin = "anonymous";
  v.src = url;
  try {
    await new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error("timeout")), 15000);
      v.onloadeddata = () => {
        clearTimeout(t);
        res();
      };
      v.onerror = () => {
        clearTimeout(t);
        rej(new Error("decode"));
      };
    });
    if (!v.videoWidth || !v.videoHeight) return { ok: false, error: "تعذر تشغيل هذا الفيديو في المتصفح. صدّروه بصيغة MP4 (H.264) ثم ارفعوه." };
    const duration = Number.isFinite(v.duration) ? v.duration : 0;
    // لقطة بعد البداية بقليل (الإطار الأول غالباً أسود)، مع انتظار اكتمال الانتقال فعلاً.
    const at = Math.min(1, duration > 0 ? duration / 4 : 0);
    if (at > 0) {
      await new Promise<void>((res) => {
        const t = setTimeout(res, 2500);
        v.onseeked = () => {
          clearTimeout(t);
          res();
        };
        v.currentTime = at;
      });
    }
    const w = Math.min(1600, v.videoWidth);
    const h = Math.round((w * v.videoHeight) / v.videoWidth);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")?.drawImage(v, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.85));
    return { ok: true, poster: blob ? new File([blob], "poster.jpg", { type: "image/jpeg" }) : null, width: v.videoWidth, height: v.videoHeight, duration };
  } catch (e) {
    return { ok: false, error: (e as Error).message === "timeout" ? "استغرقت قراءة الفيديو وقتاً طويلاً. جرّبوا فيديو أقصر أو أصغر حجماً." : "تعذر تشغيل هذا الفيديو في المتصفح. صدّروه بصيغة MP4 (H.264) ثم ارفعوه." };
  } finally {
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  }
}

/** يرفع فيديو الواجهة عبر المسار الموحد بتقدم حقيقي (XHR يقيس الإرسال). يعيد الرابط أو رسالة خطأ عربية. */
export function uploadVideo(file: File, onProgress?: (pct: number) => void): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const fd = new FormData();
    fd.set("route", "brandVideo");
    fd.set("file", file, file.name || "video.mp4");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.withCredentials = true;
    xhr.timeout = 10 * 60_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      type Reply = { error?: string; files?: { url: string }[] };
      let j: Reply | null;
      try {
        j = JSON.parse(xhr.responseText) as Reply;
      } catch {
        j = null;
      }
      const url = j?.files?.[0]?.url;
      if (xhr.status >= 200 && xhr.status < 300 && url) {
        onProgress?.(100);
        resolve({ ok: true, url });
      } else resolve({ ok: false, error: j?.error ?? (xhr.status === 413 ? "الفيديو أكبر من 40 ميجابايت." : "تعذر رفع الفيديو. حاولوا مرة أخرى.") });
    };
    xhr.onerror = () => resolve({ ok: false, error: "تعذر الاتصال. تأكدوا من الإنترنت وحاولوا مرة أخرى." });
    xhr.ontimeout = () => resolve({ ok: false, error: "الرفع أخذ وقتاً طويلاً. جرّبوا فيديو أصغر أو اتصالاً أسرع." });
    xhr.send(fd);
  });
}

/** توافق قديم: غلاف فقط. */
export async function posterFromVideo(file: File): Promise<File | null> {
  const p = await probeVideo(file);
  return p.ok ? p.poster : null;
}
