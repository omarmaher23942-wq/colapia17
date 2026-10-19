"use client";

// مشاركة المنتج (S8): على الجوال قائمة المشاركة الأصلية مع صورة المنتج نفسها جاهزة (واتساب وإنستجرام يعرضانها)
// ورابطه، وفي غيره نسخ الرابط. الصورة تُجهَّز مسبقاً بعد الخمول (لا داخل الضغطة: Safari يلغي المشاركة إن سبقها انتظار).
import { useEffect, useRef, useState } from "react";
import { Share2, Check } from "lucide-react";

export function ShareButton({ title, image, text }: { title: string; image?: string | null; text?: string }) {
  const [copied, setCopied] = useState(false);
  const file = useRef<File | null>(null);

  useEffect(() => {
    if (!image || typeof navigator === "undefined" || !navigator.canShare) return;
    let cancelled = false;
    const ac = new AbortController();
    const run = () =>
      fetch(image, { signal: ac.signal, mode: "cors" })
        .then((r) => (r.ok ? r.blob() : null))
        .then((b) => {
          if (cancelled || !b || !/^image\//.test(b.type) || b.size > 6_000_000) return;
          const ext = b.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
          const f = new File([b], `${title.slice(0, 40).replace(/[^\p{L}\p{N}]+/gu, "-") || "product"}.${ext}`, { type: b.type });
          if (navigator.canShare({ files: [f] })) file.current = f;
        })
        .catch(() => undefined);
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const id = ric ? ric(run, { timeout: 3000 }) : window.setTimeout(run, 1500);
    return () => {
      cancelled = true;
      ac.abort();
      if (!ric) window.clearTimeout(id);
    };
  }, [image, title]);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        const f = file.current;
        await navigator.share(f ? { title, text: `${text ?? title}\n${url}`, files: [f] } : { title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ألغى المستخدم المشاركة */
    }
  }
  return (
    <button
      type="button"
      onClick={share}
      aria-label={copied ? "تم نسخ الرابط" : "مشاركة المنتج"}
      className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--muted)] text-[var(--foreground)] transition-colors hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
    >
      {copied ? <Check className="size-4" strokeWidth={2.25} /> : <Share2 className="size-4" strokeWidth={1.75} />}
      <span className="sr-only" aria-live="polite">{copied ? "تم نسخ الرابط" : ""}</span>
    </button>
  );
}
