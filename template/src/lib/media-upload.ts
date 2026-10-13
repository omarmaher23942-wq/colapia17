"use client";
// media-upload.ts — رفع الصور في مشروع متجرك الخاص: على حساب UploadThing الخاص بك (المفتاح من «الربط والمفاتيح»).
// نسخة المنصة من هذا الملف ترفع عبر خادمها (src/lib/media-upload.ts). الواجهة واحدة حتى تعمل صفحات اللوحة كما هي.
import { useCallback, useState } from "react";
import type { MediaRoute } from "@/lib/media";
import { useUploadThing } from "@/lib/uploadthing-client";
import { uploadFiles } from "@/lib/uploadthing-client-direct";

export type UploadedFile = { key: string; url: string; ufsUrl: string; name: string; size: number; type: string };
type UploadError = { message: string };
type Raw = { key: string; ufsUrl: string; name: string; size: number; type: string };

const shape = (r: Raw[]): UploadedFile[] => r.map((x) => ({ key: x.key, url: x.ufsUrl, ufsUrl: x.ufsUrl, name: x.name, size: x.size, type: x.type }));

/** رفع خارج المكوّنات: نفس نتيجة الخطاف. */
export async function uploadDirect(route: MediaRoute, files: File[], input?: unknown): Promise<UploadedFile[]> {
  const r = await (uploadFiles as unknown as (route: string, opts: { files: File[]; input?: unknown }) => Promise<Raw[]>)(route, { files, input });
  return shape(r);
}

/** خطاف الرفع لكل الصفحات. onUploadError يستلم رسالة جاهزة للعرض. */
export function useMediaUpload(route: MediaRoute, opts: { onUploadError?: (e: UploadError) => void } = {}) {
  const ut = useUploadThing(route as never, { onUploadError: (e: UploadError) => opts.onUploadError?.(e) } as never) as unknown as {
    startUpload: (files: File[], input?: unknown) => Promise<Raw[] | undefined>;
    isUploading: boolean;
  };
  const [busy] = useState(false);
  const utStart = ut.startUpload;
  const startUpload = useCallback(
    async (files: File[], input?: unknown): Promise<UploadedFile[] | undefined> => {
      const r = await utStart(files, input);
      return r ? shape(r) : undefined;
    },
    [utStart]
  );
  return { startUpload, isUploading: busy || ut.isUploading };
}
