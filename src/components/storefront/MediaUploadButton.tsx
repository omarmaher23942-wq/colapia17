"use client";
// MediaUploadButton — زر «ارفع صورة» للمتجر (إيصال التحويل وما يشبهه): يضغط الصورة في المتصفح ثم يرفعها عبر
// useMediaUpload (R2 أو UploadThing). بدل زر UploadThing الجاهز حتى يعمل مع أي مزوّد وبشكل المتجر.
import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { ImagePlus, Loader2 } from "lucide-react";
import { useMediaUpload } from "@/lib/media-upload";
import type { MediaRoute } from "@/lib/media";
import { cn } from "@/lib/utils";

export function MediaUploadButton({
  route,
  input,
  label = "ارفع صورة",
  className,
  onUploaded,
  onError,
}: {
  route: MediaRoute;
  input?: unknown;
  label?: string;
  className?: string;
  onUploaded: (url: string) => void;
  onError: (message: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { startUpload } = useMediaUpload(route, { onUploadError: (e) => onError(e.message || "فشل رفع الصورة") });

  async function pick(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return onError("ارفع صورة (لقطة شاشة)، لا ملفاً آخر");
    setBusy(true);
    let file = f;
    try {
      const c = await imageCompression(f, { maxSizeMB: 1.5, maxWidthOrHeight: 2400, useWebWorker: true, initialQuality: 0.9, fileType: "image/jpeg" });
      file = new File([c], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
    } catch {
      /* يُرفع الأصل */
    }
    const res = await startUpload([file], input).catch(() => undefined);
    setBusy(false);
    if (ref.current) ref.current.value = "";
    if (res?.[0]?.url) onUploaded(res[0].url);
    else if (res) onError("فشل رفع الصورة");
  }

  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => void pick(e.target.files?.[0])} />
      <button type="button" disabled={busy} onClick={() => ref.current?.click()} className={cn("btn-brand inline-flex w-full items-center justify-center gap-2 disabled:opacity-70", className)}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
        {busy ? "جارٍ الرفع…" : label}
      </button>
    </>
  );
}
