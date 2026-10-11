"use client";

// upload.ts — رفع ملفات الاستمارة من المتصفح: ضغط الصور قبل الرفع (شبكات الموبايل)، وتحويل أي صيغة غير مقبولة
// (مثل HEIC من آيفون) إلى JPEG، ثم UploadThing بهوية رابط المسودة.
import imageCompression from "browser-image-compression";
import { uploadFiles } from "@/lib/uploadthing-client-direct";

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// بلا Web Worker: العامل يحمّل سكربته من CDN خارجي (jsdelivr) وسياسة CSP عندنا تمنعه، فيتأخر الضغط حتى يفشل ثم يعود للخيط الرئيسي.
export async function prepareImage(f: File): Promise<File> {
  const target = ACCEPTED.has(f.type) ? f.type : "image/jpeg";
  try {
    const c = await imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 2000, useWebWorker: false, fileType: target });
    const type = ACCEPTED.has(c.type) ? c.type : target;
    return new File([c], `${f.name.replace(/\.[^.]+$/, "") || "image"}.${EXT[type] ?? "jpg"}`, { type });
  } catch {
    if (ACCEPTED.has(f.type)) return f;
    throw new Error("الصيغة دي مش مدعومة. جرّب صورة JPG أو PNG.");
  }
}

export async function uploadIntakeImage(token: string, file: File, kind: "image" | "logo"): Promise<{ key: string; url: string }> {
  const [r] = await uploadFiles("intakeImage", { files: [file], input: { token, kind } });
  if (!r) throw new Error("فشل رفع الصورة.");
  return { key: r.key, url: r.ufsUrl };
}

export async function uploadIntakeVoice(token: string, file: File, durationMs: number): Promise<{ key: string; url: string }> {
  const [r] = await uploadFiles("intakeVoice", { files: [file], input: { token, durationMs: Math.round(durationMs) } });
  if (!r) throw new Error("فشل رفع التسجيل.");
  return { key: r.key, url: r.ufsUrl };
}

/** رسالة الخادم إن كانت عربية (رسائلنا)، وإلا رسالة عامة مفهومة. */
export function uploadErrorMessage(e: unknown, fallback = "فشل الرفع، جرّب تاني."): string {
  const m = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  return /[؀-ۿ]/.test(m) ? m : fallback;
}

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14));
