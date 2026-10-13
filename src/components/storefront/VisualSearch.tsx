"use client";

// VisualSearch — «دوّري بالصورة»: زر كاميرا في رأس المتجر يفتح نافذة: العميلة تختار سكرين شوت (أو تلصقه)، تُضغط
// الصورة في المتصفح وتُرسل لـ /api/storefront/visual-search، فتظهر القطعة نفسها بسعرها، أو «قريبة منها»، أو رسالة
// صادقة بزر واتساب للمتجر. أي مكان آخر (صفحة البحث) يفتحها بحدث window «clp:visual-search».
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import { Camera, ImagePlus, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { formatEgp } from "@/lib/money";
import { waLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { BrandIcon } from "./brand-icons";

type Item = { id: string; slug: string; name: string; image: string; pricePiasters: number; compareAtPiasters: number | null };
type Result = { status: "match" | "similar" | "none" | "not_product" | "limit"; match: Item | null; similar: Item[]; seen: string | null };
type State = { phase: "idle" } | { phase: "searching"; preview: string } | { phase: "done"; preview: string; result: Result } | { phase: "error"; preview?: string; message: string };

export const OPEN_VISUAL_SEARCH = "clp:visual-search";
const SW = 1.75;

export function VisualSearch({ whatsapp, storeName }: { whatsapp?: string; storeName: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ phase: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  // النافذة تُرسم في جذر المتجر (لا داخل الرأس: الرأس بخلفية ضبابية يصبح مرجع position: fixed) فترث ألوانه.
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => setHost(btnRef.current?.closest(".storefront") ?? document.body), []);

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
    if (!f.type.startsWith("image/")) return setState({ phase: "error", message: "اختاري صورة (سكرين شوت للقطعة)." });
    const preview = URL.createObjectURL(f);
    setState({ phase: "searching", preview });
    let file: File = f;
    try {
      const c = await imageCompression(f, { maxSizeMB: 0.6, maxWidthOrHeight: 1280, useWebWorker: true, fileType: "image/jpeg", initialQuality: 0.85 });
      file = new File([c], "search.jpg", { type: "image/jpeg" });
    } catch {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return setState({ phase: "error", preview, message: "الصيغة دي مش مدعومة، جرّبي صورة JPG أو PNG." });
    }
    const body = new FormData();
    body.set("image", file);
    try {
      const r = await fetch("/api/storefront/visual-search", { method: "POST", body });
      const j = (await r.json().catch(() => null)) as (Result & { error?: string }) | null;
      if (!r.ok || !j) return setState({ phase: "error", preview, message: j?.error ?? "تعذر البحث الآن، جرّبي تاني." });
      window.clpTrack?.("visual_search", { status: j.status });
      setState({ phase: "done", preview, result: j });
    } catch {
      setState({ phase: "error", preview, message: "النت فيه مشكلة، جرّبي تاني." });
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
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("paste", onPaste);
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, search, close]);

  const ask = waLink(whatsapp, `أهلاً ${storeName}، عندي صورة قطعة عايزة أعرف هي متوفرة عندكم؟ (هبعتلكم الصورة هنا)`);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-10 place-items-center rounded-xl opacity-80 transition-opacity hover:opacity-100"
        aria-label="دوّري بالصورة"
        title="دوّري بالصورة"
      >
        <Camera className="size-4.5" strokeWidth={SW} aria-hidden="true" />
      </button>

      {open && host ? createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={close}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="دوّري بالصورة"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl p-5 outline-none sm:max-w-lg sm:rounded-3xl"
            style={{ background: "var(--card)", color: "var(--foreground)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-heading text-lg font-black">
                  <Sparkles className="size-5" style={{ color: "var(--primary)" }} strokeWidth={SW} aria-hidden="true" /> دوّري بالصورة
                </p>
                <p className="mt-1 text-sm opacity-70">ارفعي سكرين شوت للقطعة اللي عجبتك من الريلز أو أي صورة، ونفتحلك صفحتها.</p>
              </div>
              <button type="button" onClick={close} className="grid size-9 shrink-0 place-items-center rounded-xl opacity-60 hover:opacity-100" aria-label="إغلاق">
                <X className="size-5" strokeWidth={SW} aria-hidden="true" />
              </button>
            </div>

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
                <span className="font-bold">اختاري صورة أو صوّري</span>
                <span className="hidden text-xs opacity-60 sm:block">أو الصقي الصورة هنا (Ctrl+V)</span>
              </button>
            ) : null}

            {"preview" in state && state.preview ? (
              <div className="mt-5 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={state.preview} alt="الصورة التي اخترتِها" className="size-20 shrink-0 rounded-xl border object-cover" style={{ borderColor: "var(--border)" }} />
                {state.phase === "searching" ? (
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> بندوّر على القطعة في المتجر…
                  </p>
                ) : state.phase === "done" && state.result.seen ? (
                  <p className="text-sm opacity-70">فهمنا إنها: {state.result.seen}</p>
                ) : null}
              </div>
            ) : null}

            {state.phase === "error" ? (
              <div className="mt-4 space-y-3">
                <p role="alert" className="text-sm font-bold text-rose-500">{state.message}</p>
                <Retry onClick={() => fileRef.current?.click()} />
              </div>
            ) : null}

            {state.phase === "done" ? (
              <div className="mt-5 space-y-5" aria-live="polite">
                {state.result.match ? (
                  <div>
                    <p className="mb-2 text-sm font-black">لقيناها</p>
                    <ProductRow item={state.result.match} big onNavigate={close} />
                  </div>
                ) : (
                  <p className="text-sm font-bold">
                    {state.result.status === "not_product"
                      ? "مش واضح في الصورة قطعة نقدر ندوّر عليها. جرّبي سكرين شوت أقرب للقطعة."
                      : state.result.status === "limit"
                        ? "البحث بالصورة مش متاح دلوقتي. جرّبي البحث بالكلمات أو كلّمي المتجر."
                        : state.result.similar.length
                          ? "ملقيناش القطعة دي بالظبط، بس دي قريبة منها:"
                          : "ملقيناش القطعة دي في المتجر."}
                  </p>
                )}
                {state.result.similar.length ? (
                  <div>
                    {state.result.match ? <p className="mb-2 text-sm font-black opacity-80">وقريبة منها</p> : null}
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
                      <BrandIcon brand="whatsapp" className="size-4" /> اسألي المتجر على واتساب
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>,
        host
      ) : null}
    </>
  );
}

function Retry({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold" style={{ borderColor: "var(--border)" }}>
      <RefreshCw className="size-4" strokeWidth={SW} aria-hidden="true" /> صورة تانية
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
      {big ? <span className="btn-brand shrink-0 px-3 py-2 text-sm">افتحي القطعة</span> : null}
    </Link>
  );
}
