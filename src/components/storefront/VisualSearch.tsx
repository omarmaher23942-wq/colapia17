"use client";

// VisualSearch — «البحث بالصورة»: زر كاميرا في رأس المتجر يفتح نافذة: الزائر يختار سكرين شوت (أو يلصقه)، تُضغط
// الصورة في المتصفح وتُرسل لـ /api/storefront/visual-search، فتظهر القطعة نفسها بسعرها، أو «قريبة منها»، أو رسالة
// صادقة بزر واتساب للمتجر. أي مكان آخر (صفحة البحث) يفتحها بحدث window «clp:visual-search».
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import { Camera, ImagePlus, Loader2, RefreshCw } from "lucide-react";
import { formatEgp } from "@/lib/money";
import { waLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { BrandIcon } from "./brand-icons";
import { SheetDialog } from "./SheetDialog";

type Item = { id: string; slug: string; name: string; image: string; pricePiasters: number; compareAtPiasters: number | null };
type Result = { status: "match" | "similar" | "none" | "not_product" | "limit"; match: Item | null; similar: Item[]; seen: string | null };
type State = { phase: "idle" } | { phase: "searching"; preview: string } | { phase: "done"; preview: string; result: Result } | { phase: "error"; preview?: string; message: string };

export const OPEN_VISUAL_SEARCH = "clp:visual-search";
const SW = 1.75;

export function VisualSearch({ whatsapp, storeName }: { whatsapp?: string; storeName: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ phase: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_VISUAL_SEARCH, onOpen);
    return () => window.removeEventListener(OPEN_VISUAL_SEARCH, onOpen);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setState((s) => {
      if ("preview" in s && s.preview) URL.revokeObjectURL(s.preview);
      return { phase: "idle" };
    });
  }, []);

  const search = useCallback(async (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setState({ phase: "error", message: "الملف المختار ليس صورة. يلزم اختيار صورة للقطعة (لقطة شاشة مثلاً)." });
    const preview = URL.createObjectURL(f);
    setState({ phase: "searching", preview });
    let file: File = f;
    try {
      const c = await imageCompression(f, { maxSizeMB: 0.6, maxWidthOrHeight: 1280, useWebWorker: false, fileType: "image/jpeg", initialQuality: 0.85 });
      file = new File([c], "search.jpg", { type: "image/jpeg" });
    } catch {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return setState({ phase: "error", preview, message: "صيغة الصورة غير مدعومة. الصيغ المتاحة: JPG أو PNG." });
    }
    const body = new FormData();
    body.set("image", file);
    try {
      const r = await fetch("/api/storefront/visual-search", { method: "POST", body });
      const j = (await r.json().catch(() => null)) as (Result & { error?: string }) | null;
      if (!r.ok || !j) return setState({ phase: "error", preview, message: j?.error ?? "تعذر البحث الآن. يمكن المحاولة مرة أخرى بعد لحظات." });
      window.clpTrack?.("visual_search", { status: j.status });
      setState({ phase: "done", preview, result: j });
    } catch {
      setState({ phase: "error", preview, message: "الاتصال بالإنترنت متقطع. يمكن المحاولة مرة أخرى." });
    }
  }, []);

  // لصق صورة من الحافظة (Ctrl+V على الكمبيوتر) والنافذة مفتوحة.
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/"));
      if (f) {
        e.preventDefault();
        void search(f);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, search]);

  const ask = waLink(whatsapp, `أهلاً ${storeName}، عندي صورة قطعة وأريد أن أعرف هل هي متوفرة عندكم؟ (سأرسل الصورة هنا)`);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-10 place-items-center rounded-xl opacity-80 transition-opacity hover:opacity-100"
        aria-label="البحث بالصورة"
        title="البحث بالصورة"
      >
        <Camera className="size-4.5" strokeWidth={SW} aria-hidden="true" />
      </button>

      <SheetDialog open={open} onClose={close} title="البحث بالصورة" side="bottom">
        <p className="text-sm opacity-70">صورة أو لقطة شاشة لأي قطعة من الريلز أو غيرها، ونفتح صفحتها في المتجر إن كانت متوفرة.</p>

            <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => void search(e.target.files?.[0])} />

            {state.phase === "idle" ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-5 flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors hover:opacity-90"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="grid size-14 place-items-center rounded-2xl" style={{ background: "color-mix(in oklab, var(--primary) 14%, transparent)", color: "var(--primary)" }}>
                  <ImagePlus className="size-7" strokeWidth={SW} aria-hidden="true" />
                </span>
                <span className="font-bold">اختيار صورة أو التقاطها</span>
                <span className="hidden text-xs opacity-60 sm:block">أو لصق الصورة هنا (Ctrl+V)</span>
              </button>
            ) : null}

            {"preview" in state && state.preview ? (
              <div className="mt-5 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={state.preview} alt="الصورة المختارة" className="size-20 shrink-0 rounded-xl border object-cover" style={{ borderColor: "var(--border)" }} />
                {state.phase === "searching" ? (
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> نبحث عن القطعة في المتجر…
                  </p>
                ) : state.phase === "done" && state.result.seen ? (
                  <p className="text-sm opacity-70">فهمنا أنها: {state.result.seen}</p>
                ) : null}
              </div>
            ) : null}

            {state.phase === "error" ? (
              <div className="mt-4 space-y-3">
                <p role="alert" className="text-sm font-bold text-danger">{state.message}</p>
                <Retry onClick={() => fileRef.current?.click()} />
              </div>
            ) : null}

            {state.phase === "done" ? (
              <div className="mt-5 space-y-5" aria-live="polite">
                {state.result.match ? (
                  <div>
                    <p className="mb-2 text-sm font-black">وجدناها</p>
                    <ProductRow item={state.result.match} big onNavigate={close} />
                  </div>
                ) : (
                  <p className="text-sm font-bold">
                    {state.result.status === "not_product"
                      ? "لم تظهر في الصورة قطعة واضحة للبحث عنها. صورة أقرب للقطعة تعطي نتيجة أفضل."
                      : state.result.status === "limit"
                        ? "البحث بالصورة غير متاح حالياً. يمكنك البحث بالكلمات أو التواصل مع المتجر."
                        : state.result.similar.length
                          ? "لم نجد القطعة نفسها، وهذه أقرب القطع لها:"
                          : "لم نجد هذه القطعة في المتجر."}
                  </p>
                )}
                {state.result.similar.length ? (
                  <div>
                    {state.result.match ? <p className="mb-2 text-sm font-black opacity-80">وقطع قريبة منها</p> : null}
                    <div className="space-y-2">
                      {state.result.similar.map((s) => (
                        <ProductRow key={s.id} item={s} onNavigate={close} />
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Retry onClick={() => fileRef.current?.click()} />
                  {!state.result.match && ask ? (
                    <a href={ask} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-bold text-white">
                      <BrandIcon brand="whatsapp" className="size-4" /> مراسلة المتجر على واتساب
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}
      </SheetDialog>
    </>
  );
}

function Retry({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold" style={{ borderColor: "var(--border)" }}>
      <RefreshCw className="size-4" strokeWidth={SW} aria-hidden="true" /> صورة أخرى
    </button>
  );
}

function ProductRow({ item, big, onNavigate }: { item: Item; big?: boolean; onNavigate: () => void }) {
  return (
    <Link href={`/p/${item.slug}`} onClick={onNavigate} className={cn("flex items-center gap-3 rounded-2xl border p-2.5 transition-opacity hover:opacity-90", big && "p-3")} style={{ borderColor: "var(--border)" }}>
      <Image src={item.image} alt={item.name} width={big ? 96 : 64} height={big ? 96 : 64} className={cn("shrink-0 rounded-xl object-cover", big ? "size-24" : "size-16")} unoptimized />
      <span className="min-w-0 flex-1">
        <span className={cn("line-clamp-2 font-bold", big ? "text-base" : "text-sm")}>{item.name}</span>
        <span className="mt-1 flex items-baseline gap-2">
          <span className="font-black" style={{ color: "var(--primary)" }}>{formatEgp(item.pricePiasters)}</span>
          {item.compareAtPiasters && item.compareAtPiasters > item.pricePiasters ? <s className="text-xs opacity-50">{formatEgp(item.compareAtPiasters)}</s> : null}
        </span>
      </span>
      {big ? <span className="btn-brand shrink-0 px-3 py-2 text-sm">عرض القطعة</span> : null}
    </Link>
  );
}
