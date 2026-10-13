"use client";
// media-upload.ts — رفع الملفات من المتصفح بواجهة واحدة لكل الصفحات: R2 (إذن من /api/upload ← PUT مباشر إلى R2 ←
// تأكيد من /api/upload/complete) متى كان NEXT_PUBLIC_MEDIA_PROVIDER=r2، وإلا UploadThing كما كان. النتيجة نفسها في
// الحالتين: [{ key, url, ufsUrl, name, size, type }].
import { useCallback, useState } from "react";
import { MEDIA_PROVIDER, type MediaRoute } from "@/lib/media";
import { useUploadThing } from "@/lib/uploadthing-client";
import { uploadFiles } from "@/lib/uploadthing-client-direct";

export type UploadedFile = { key: string; url: string; ufsUrl: string; name: string; size: number; type: string };
type UploadError = { message: string };

async function readError(r: Response, fallback: string): Promise<string> {
  const j = (await r.json().catch(() => null)) as { error?: string } | null;
  return j?.error || fallback;
}

/** رفع مباشر إلى R2 بثلاث خطوات (الإذن، الرفع، التأكيد). يرمي Error برسالة عربية مفهومة عند أي فشل. */
export async function uploadToR2(route: MediaRoute, files: File[], input?: unknown): Promise<UploadedFile[]> {
  const grant = await fetch("/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ route, input, files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })) }),
  });
  if (!grant.ok) throw new Error(await readError(grant, "تعذر بدء الرفع. حاول مرة أخرى."));
  const { uploads } = (await grant.json()) as { uploads: { key: string; url: string; putUrl: string; headers: Record<string, string>; ticket: string }[] };
  await Promise.all(
    uploads.map(async (u, i) => {
      const r = await fetch(u.putUrl, { method: "PUT", headers: u.headers, body: files[i] });
      if (!r.ok) throw new Error("تعذر رفع الملف. تأكد من الاتصال وحاول مرة أخرى.");
    })
  );
  const done = await fetch("/api/upload/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tickets: uploads.map((u) => u.ticket) }),
  });
  if (!done.ok) throw new Error(await readError(done, "تعذر تأكيد الرفع. حاول مرة أخرى."));
  return uploads.map((u, i) => ({ key: u.key, url: u.url, ufsUrl: u.url, name: files[i]!.name, size: files[i]!.size, type: files[i]!.type }));
}

/** رفع خارج المكوّنات (الاستمارة): نفس نتيجة الخطاف. */
export async function uploadDirect(route: MediaRoute, files: File[], input?: unknown): Promise<UploadedFile[]> {
  if (MEDIA_PROVIDER === "r2") return uploadToR2(route, files, input);
  const r = await (uploadFiles as unknown as (route: string, opts: { files: File[]; input?: unknown }) => Promise<{ key: string; ufsUrl: string; name: string; size: number; type: string }[]>)(route, { files, input });
  return r.map((x) => ({ key: x.key, url: x.ufsUrl, ufsUrl: x.ufsUrl, name: x.name, size: x.size, type: x.type }));
}

/** خطاف الرفع لكل الصفحات (بدل useUploadThing). onUploadError يستلم رسالة عربية جاهزة للعرض. */
export function useMediaUpload(route: MediaRoute, opts: { onUploadError?: (e: UploadError) => void } = {}) {
  const ut = useUploadThing(route as never, { onUploadError: (e: UploadError) => opts.onUploadError?.(e) } as never) as unknown as {
    startUpload: (files: File[], input?: unknown) => Promise<{ key: string; ufsUrl: string; name: string; size: number; type: string }[] | undefined>;
    isUploading: boolean;
  };
  const [busy, setBusy] = useState(false);
  const { onUploadError } = opts;
  const utStart = ut.startUpload;
  const startUpload = useCallback(
    async (files: File[], input?: unknown): Promise<UploadedFile[] | undefined> => {
      if (MEDIA_PROVIDER !== "r2") {
        const r = await utStart(files, input);
        return r?.map((x) => ({ key: x.key, url: x.ufsUrl, ufsUrl: x.ufsUrl, name: x.name, size: x.size, type: x.type }));
      }
      setBusy(true);
      try {
        return await uploadToR2(route, files, input);
      } catch (e) {
        onUploadError?.({ message: e instanceof Error ? e.message : "تعذر رفع الملف" });
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [route, utStart, onUploadError]
  );
  return { startUpload, isUploading: busy || ut.isUploading };
}
