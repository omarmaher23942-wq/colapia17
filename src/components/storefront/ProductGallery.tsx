"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const SW = 1.75;

type Img = { url: string; alt?: string };
export function ProductGallery({
  images,
  name,
  immersive,
}: {
  images: Img[];
  name: string;
  immersive?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zooming, setZooming] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const stripRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const current = images[idx] ?? images[0];

  const go = useCallback(
    (dir: -1 | 1) => {
      setIdx((cur) => {
        const total = images.length || 1;
        const n = cur + dir;
        if (n < 0) return total - 1;
        if (n >= total) return 0;
        return n;
      });
    },
    [images.length]
  );

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowRight") go(-1);
      if (e.key === "ArrowLeft") go(1);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [lightbox, go]);

  // اختيار لون له صورة خاصة في صفحة المنتج (ProductPurchase) ينقل المعرض إليها.
  useEffect(() => {
    const onShow = (e: Event) => {
      const url = (e as CustomEvent<{ url?: string }>).detail?.url;
      const i = url ? images.findIndex((im) => im.url === url) : -1;
      if (i >= 0) setIdx(i);
    };
    window.addEventListener("clp:show-image", onShow);
    return () => window.removeEventListener("clp:show-image", onShow);
  }, [images]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const active = strip.children[idx] as HTMLElement | undefined;
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [idx]);

  // View Transitions عند فتح/غلق الـ lightbox
  const openLightbox = useCallback(() => {
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    if (reduce || typeof doc.startViewTransition !== "function") {
      setLightbox(true);
      return;
    }
    doc.startViewTransition(() => setLightbox(true));
  }, [reduce]);

  const closeLightbox = useCallback(() => {
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    if (reduce || typeof doc.startViewTransition !== "function") {
      setLightbox(false);
      return;
    }
    doc.startViewTransition(() => setLightbox(false));
  }, [reduce]);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setZoomPos({ x, y });
  };

  if (!images.length) {
    return (
      <div
        className="aspect-square rounded-3xl border"
        style={{ background: "var(--muted)", borderColor: "var(--border)" }}
        aria-hidden="true"
      />
    );
  }

  const Thumbnails = (
    <div
      ref={stripRef}
      className={cn(
        "hide-scrollbar flex gap-2 overflow-x-auto",
        immersive
          ? "lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:max-h-[560px]"
          : "mt-3"
      )}
      role="tablist"
      aria-label="صور المنتج"
    >
      {images.map((im, k) => (
        <button
          key={`img-${im.url}-${k}`}
          type="button"
          role="tab"
          aria-selected={k === idx}
          aria-label={`صورة ${k + 1}`}
          onClick={() => setIdx(k)}
          className={cn(
            "relative size-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2",
            k === idx
              ? "border-[var(--primary)] opacity-100"
              : "border-transparent opacity-60 hover:opacity-100"
          )}
          style={{ background: "var(--muted)" }}
        >
          <Image src={im.url} alt="" fill sizes="64px" className="object-cover" />
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className={cn(immersive && "lg:grid lg:grid-cols-[80px_1fr] lg:gap-3")}>
        {immersive ? Thumbnails : null}

        {/* Main viewer */}
        <div
          className={cn(
            "group relative aspect-square overflow-hidden rounded-3xl border sm:aspect-[4/3]",
            !reduce && !zooming && "cursor-zoom-in",
            !reduce && zooming && "cursor-zoom-out"
          )}
          style={{ background: "var(--muted)", borderColor: "var(--border)" }}
          onMouseEnter={() => !reduce && setZooming(true)}
          onMouseLeave={() => setZooming(false)}
          onMouseMove={onMouseMove}
          onClick={openLightbox}
          role="button"
          tabIndex={0}
          aria-label="عرض الصورة بملء الشاشة"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openLightbox();
            }
          }}
        >
          {current ? (
            <Image
              key={current.url}
              src={current.url}
              alt={current.alt || name}
              fill
              priority
              sizes="(max-width:1024px) 100vw, 50vw"
              className={cn(
                "object-cover transition-transform duration-300",
                zooming && !reduce ? "" : "group-hover:scale-105"
              )}
              style={
                zooming && !reduce
                  ? {
                      transform: "scale(2.5)",
                      transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                    }
                  : undefined
              }
            />
          ) : null}

          {/* Zoom Lens marker */}
          {zooming && !reduce ? (
            <span
              className="pointer-events-none absolute size-14 rounded-full border-2 border-white/80 shadow-lg"
              style={{
                left: `calc(${zoomPos.x}% - 28px)`,
                top: `calc(${zoomPos.y}% - 28px)`,
                background: "rgba(255,255,255,0.05)",
                backdropFilter: "blur(2px)",
              }}
              aria-hidden="true"
            />
          ) : null}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openLightbox();
            }}
            className="absolute end-3 top-3 grid size-10 place-items-center rounded-xl bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/75 focus-visible:opacity-100 group-hover:opacity-100"
            aria-label="تكبير الصورة"
          >
            <ZoomIn className="size-4" strokeWidth={SW} aria-hidden="true" />
          </button>

          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                aria-label="السابق"
                className="absolute end-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <ChevronRight className="size-4" strokeWidth={SW} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                aria-label="التالي"
                className="absolute start-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <ChevronLeft className="size-4" strokeWidth={SW} aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>

        {!immersive ? Thumbnails : null}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && current ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 backdrop-blur-md"
            onClick={closeLightbox}
            role="dialog"
            aria-modal="true"
            aria-label="عرض الصورة"
          >
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute end-4 top-4 grid size-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="إغلاق"
            >
              <X className="size-5" strokeWidth={SW} aria-hidden="true" />
            </button>

            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); go(-1); }}
                  aria-label="السابق"
                  className="absolute end-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronRight className="size-6" strokeWidth={SW} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); go(1); }}
                  aria-label="التالي"
                  className="absolute start-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronLeft className="size-6" strokeWidth={SW} aria-hidden="true" />
                </button>
              </>
            ) : null}

            {current ? (
              <motion.img
                key={current.url}
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: reduce ? 0 : 0.24 }}
                src={current.url}
                alt={name}
                className="max-h-[85vh] max-w-[95vw] rounded-2xl object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}