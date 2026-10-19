"use client";
// media-upload.ts — رفع الملفات من المتصفح بواجهة واحدة لكل الصفحات: كل ملف في طلب multipart إلى /api/upload
// على موقعنا نفسه (الخادم يتحقق ويكتب في مساحة الملفات). لا اتصال بمضيف آخر من المتصفح.
import { useCallback, useState } from "react";
import type { MediaRoute } from "@/lib/media";

export type UploadedFile = { key: string; url: string; ufsUrl: string; name: string; size: number; type: string };
type UploadError = { message: string };

const TIMEOUT_MS = 120_000;
const PARALLEL = 3;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** أخطاء عابرة تستحق محاولة ثانية: انقطاع الشبكة، أو 502/503/504، أو مهلة. غيرها (حجم، نوع، صلاحية، حد) نهائي. */
export function isTransientUploadFailure(status: number | null, aborted: boolean): boolean {
  return status === null || aborted || status === 502 || status === 503 || status === 504;
}

const NETWORK_ERR = "تعذر الاتصال. تأكدوا من الإنترنت وحاولوا مرة أخرى.";
const TIMEOUT_ERR = "الرفع أخذ وقتاً طويلاً. تأكدوا من الاتصال وحاولوا مرة أخرى.";

/** محاولة واحدة. تعيد ملفاً أو خطأً مع علامة «عابر». */
async function attempt(route: MediaRoute, file: File, input?: unknown): Promise<{ ok: true; file: UploadedFile } | { ok: false; error: string; transient: boolean }> {
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
    const aborted = (e as Error)?.name === "AbortError";
    return { ok: false, error: aborted ? TIMEOUT_ERR : NETWORK_ERR, transient: isTransientUploadFailure(null, aborted) };
  } finally {
    clearTimeout(timer);
  }
  const j = (await r.json().catch(() => null)) as { error?: string; files?: { key: string; url: string; type?: string; size?: number }[] } | null;
  const f = j?.files?.[0];
  if (!r.ok || !f) {
    return { ok: false, error: j?.error || (r.status === 413 ? "الصورة كبيرة. الحد الأقصى 8 ميجا." : "تعذر رفع الصورة. حاولوا مرة أخرى."), transient: isTransientUploadFailure(r.status, false) };
  }
  return { ok: true, file: { key: f.key, url: f.url, ufsUrl: f.url, name: file.name, size: f.size ?? file.size, type: f.type ?? file.type } };
}

/** يرفع ملفاً واحداً بمحاولتين للأعطال العابرة. يرمي Error برسالة عربية مفهومة عند الفشل. */
async function uploadOne(route: MediaRoute, file: File, input?: unknown): Promise<UploadedFile> {
  let last = await attempt(route, file, input);
  for (let i = 0; !last.ok && last.transient && i < 2; i++) {
    await wait(900 * (i + 1));
    last = await attempt(route, file, input);
  }
  if (!last.ok) throw new Error(last.error);
  return last.file;
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
        error ??= e instanceof Error ? e.message : "تعذر رفع الصورة. حاولوا مرة أخرى.";
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
