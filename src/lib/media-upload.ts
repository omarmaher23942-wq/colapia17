"use client";
// media-upload.ts — رفع الملفات من المتصفح بواجهة واحدة لكل الصفحات: كل ملف في طلب multipart إلى /api/upload
// على موقعنا نفسه (الخادم يتحقق ويكتب في مساحة الملفات). لا اتصال بمضيف آخر من المتصفح.
import { useCallback, useState } from "react";
import type { MediaRoute } from "@/lib/media";

export type UploadedFile = { key: string; url: string; ufsUrl: string; name: string; size: number; type: string };
type UploadError = { message: string };

const TIMEOUT_MS = 120_000;
const PARALLEL = 3;

/** يرفع ملفاً واحداً. يرمي Error برسالة عربية مفهومة عند أي فشل. */
async function uploadOne(route: MediaRoute, file: File, input?: unknown): Promise<UploadedFile> {
  const fd = new FormData();
  fd.set("route", route);
  if (input !== undefined) fd.set("input", JSON.stringify(input));
  fd.set("file", file, file.name || "image");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let r: Response;
  try {
    r = await fetch("/api/upload", { method: "POST", body: fd, signal: ctrl.signal, credentials: "same-origin" });
  } catch (e) {
    throw new Error((e as Error)?.name === "AbortError" ? "الرفع أخذ وقتاً طويلاً. تأكد من الاتصال وحاول مرة أخرى." : "تعذر الاتصال. تأكد من الإنترنت وحاول مرة أخرى.");
  } finally {
    clearTimeout(timer);
  }
  const j = (await r.json().catch(() => null)) as { error?: string; files?: { key: string; url: string; type?: string; size?: number }[] } | null;
  const f = j?.files?.[0];
  if (!r.ok || !f) throw new Error(j?.error || (r.status === 413 ? "الصورة كبيرة. الحد الأقصى 8 ميجا." : "تعذر رفع الصورة. حاول مرة أخرى."));
  return { key: f.key, url: f.url, ufsUrl: f.url, name: file.name, size: f.size ?? file.size, type: f.type ?? file.type };
}

/** رفع عدة ملفات (ثلاثة متوازية) مع حفظ الترتيب. يعيد ما نجح، وأول رسالة خطأ إن فشل بعضها. */
export async function uploadMany(route: MediaRoute, files: File[], input?: unknown): Promise<{ done: UploadedFile[]; error: string | null }> {
  const results: (UploadedFile | null)[] = files.map(() => null);
  let error: string | null = null;
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const i = next++;
      try {
        results[i] = await uploadOne(route, files[i]!, input);
      } catch (e) {
        error ??= e instanceof Error ? e.message : "تعذر رفع الصورة. حاول مرة أخرى.";
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, files.length) }, worker));
  return { done: results.filter((x): x is UploadedFile => x !== null), error };
}

/** رفع خارج المكوّنات (الاستمارة): نفس نتيجة الخطاف، ويرمي عند الفشل. */
export async function uploadDirect(route: MediaRoute, files: File[], input?: unknown): Promise<UploadedFile[]> {
  const { done, error } = await uploadMany(route, files, input);
  if (error && !done.length) throw new Error(error);
  return done;
}

/** خطاف الرفع لكل الصفحات. onUploadError يستلم رسالة عربية جاهزة للعرض؛ startUpload يعيد undefined إن لم ينجح أي ملف. */
export function useMediaUpload(route: MediaRoute, opts: { onUploadError?: (e: UploadError) => void } = {}) {
  const [busy, setBusy] = useState(0);
  const { onUploadError } = opts;
  const startUpload = useCallback(
    async (files: File[], input?: unknown): Promise<UploadedFile[] | undefined> => {
      setBusy((n) => n + 1);
      try {
        const { done, error } = await uploadMany(route, files, input);
        if (error) onUploadError?.({ message: error });
        return done.length ? done : undefined;
      } finally {
        setBusy((n) => Math.max(0, n - 1));
      }
    },
    [route, onUploadError]
  );
  return { startUpload, isUploading: busy > 0 };
}
