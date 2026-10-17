"use client";
// upload.ts — رفع صور المنتجات من الإعداد: تصحيح/قص اختياري، ضغط، ثم رفع بثلاث متوازية عبر المسار الموحد.
import imageCompression from "browser-image-compression";
import { cleanupImage } from "@/lib/image-prep";
import { uploadMany } from "@/lib/media-upload";
import type { MediaRoute } from "@/lib/media";

async function prep(f: File, cleanup: boolean): Promise<File> {
  let file = f;
  if (cleanup) file = await cleanupImage(file);
  try {
    const c = await imageCompression(file, { maxSizeMB: 1.2, maxWidthOrHeight: 2000, useWebWorker: false, initialQuality: 0.88, fileType: "image/jpeg" });
    return new File([c], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** يجهّز ويرفع الصور مع تقدم؛ يعيد الروابط بترتيب الملفات (ما فشل يُحذف) وأول رسالة خطأ إن وُجدت. */
export async function uploadImages(
  files: File[],
  opts: { cleanup?: boolean; route?: MediaRoute; onProgress?: (done: number, total: number) => void } = {}
): Promise<{ urls: string[]; error: string | null }> {
  const route = opts.route ?? "productImage";
  const urls: string[] = [];
  let error: string | null = null;
  let done = 0;
  // دفعات من 3: تحضير الصور في المتصفح أثقل من الرفع نفسه.
  for (let i = 0; i < files.length; i += 3) {
    const batch = files.slice(i, i + 3);
    const prepared = await Promise.all(batch.map((f) => prep(f, Boolean(opts.cleanup))));
    const r = await uploadMany(route, prepared);
    urls.push(...r.done.map((d) => d.url));
    error ??= r.error;
    done += batch.length;
    opts.onProgress?.(done, files.length);
  }
  return { urls, error };
}

/** يلتقط صورة غلاف من أول لقطات فيديو (لتظهر الواجهة فوراً قبل تحميله). */
export async function posterFromVideo(file: File): Promise<File | null> {
  try {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.src = url;
    await new Promise<void>((res, rej) => {
      v.onloadeddata = () => res();
      v.onerror = () => rej(new Error("video"));
      setTimeout(() => rej(new Error("timeout")), 8000);
    });
    v.currentTime = Math.min(1, (v.duration || 2) / 3);
    await new Promise<void>((res) => {
      v.onseeked = () => res();
      setTimeout(res, 1500);
    });
    const w = Math.min(1600, v.videoWidth || 1280);
    const h = Math.round((w * (v.videoHeight || 720)) / (v.videoWidth || 1280));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")?.drawImage(v, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.85));
    return blob ? new File([blob], "poster.jpg", { type: "image/jpeg" }) : null;
  } catch {
    return null;
  }
}
