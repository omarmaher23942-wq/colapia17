"use client";

// ProductGallery — معرض صور وفيديو المنتج.
// الموبايل: شريط سحب أفقي بالتقاط (scroll-snap) مع عدّاد ونقاط. الحاسوب: صورة رئيسية بنسبتها الطبيعية على خلفية هادئة
// وشريط مصغّرات يتحرك داخل نفسه فقط (scrollTo، لا scrollIntoView فلا تقفز الصفحة). التكبير بالتمرير للماوس فقط.
// الضغط على الصورة يفتح عارضاً على <dialog> أصلي (ImageLightbox) في الطبقة العليا.
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageLightbox } from "./product/ImageLightbox";

type Img = { url: string; alt?: string };
type Vid = { url: string; poster?: string };
type Slide = { kind: "image"; url: string; alt?: string } | { kind: "video"; url: string; poster?: string };

export function ProductGallery({
  images,
  videos = [],
  name,
  immersive,
}: {
  images: Img[];
  videos?: Vid[];
  name: string;
  immersive?: boolean;
}) {
  // صور اللون المختار (إن وُجدت) تُقدَّم وحدها؛ بدون اختيار تظهر كل الصور.
  const [only, setOnly] = useState<string[] | null>(null);
  const slides = useMemo<Slide[]>(() => {
    const imgs = only?.length ? images.filter((i) => only.includes(i.url)) : images;
    const list: Slide[] = (imgs.length ? imgs : images).map((i) => ({ kind: "image", url: i.url, alt: i.alt }));
    for (const v of videos) list.push({ kind: "video", url: v.url, poster: v.poster });
    return list;
  }, [images, videos, only]);
  const imageSlides = useMemo(() => slides.filter((s): s is Extract<Slide, { kind: "image" }> => s.kind === "image"), [slides]);

  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const programmatic = useRef(false);

  const scrollToIndex = useCallback((i: number, smooth = true) => {
    const track = trackRef.current;
    const el = track?.children[i] as HTMLElement | undefined;
    if (!track || !el) return;
    programmatic.current = true;
    track.scrollTo({ left: el.offsetLeft, behavior: smooth ? "smooth" : "auto" });
    window.setTimeout(() => (programmatic.current = false), 450);
  }, []);

  const select = useCallback(
    (i: number) => {
      const n = Math.max(0, Math.min(slides.length - 1, i));
      setIdx(n);
      scrollToIndex(n);
    },
    [slides.length, scrollToIndex]
  );

  // تتبّع الشريحة الظاهرة عند السحب
  useEffect(() => {
    const track = trackRef.current;
    if (!track || slides.length < 2) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (programmatic.current) return;
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.6) setIdx(Array.prototype.indexOf.call(track.children, e.target));
        }
      },
      { root: track, threshold: [0.6] }
    );
    Array.from(track.children).forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [slides.length]);

  // اختيار لون: صوره وحدها، أو الانتقال لصورة محددة
  useEffect(() => {
    const onShow = (e: Event) => {
      const d = (e as CustomEvent<{ url?: string; urls?: string[] | null }>).detail;
      if (d && "urls" in d) {
        setOnly(d.urls?.length ? d.urls : null);
        setIdx(0);
        requestAnimationFrame(() => scrollToIndex(0, false));
        return;
      }
      const i = d?.url ? slides.findIndex((s) => s.kind === "image" && s.url === d.url) : -1;
      if (i >= 0) select(i);
    };
    window.addEventListener("clp:show-image", onShow);
    return () => window.removeEventListener("clp:show-image", onShow);
  }, [slides, select, scrollToIndex]);

  // المصغّرات تتحرك داخل شريطها فقط
  useEffect(() => {
    const strip = stripRef.current;
    const el = strip?.children[idx] as HTMLElement | undefined;
    if (!strip || !el) return;
    const horizontal = strip.scrollWidth > strip.clientWidth + 2;
    if (horizontal) strip.scrollTo({ left: el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
    else strip.scrollTo({ top: el.offsetTop - strip.clientHeight / 2 + el.clientHeight / 2, behavior: "smooth" });
  }, [idx]);

  if (!slides.length) {
    return <div className="aspect-[4/5] rounded-3xl border" style={{ background: "var(--muted)", borderColor: "var(--border)" }} aria-hidden="true" />;
  }

  const openAt = (i: number) => {
    const s = slides[i];
    if (!s || s.kind !== "image") return;
    setLightbox(true);
  };
  const lightboxIndex = Math.max(0, imageSlides.findIndex((s) => s.url === (slides[idx] as Slide | undefined)?.url));

  const thumbs = slides.length > 1 && (
    <div
      ref={stripRef}
      className={cn("hide-scrollbar flex gap-2 overflow-x-auto", immersive ? "lg:max-h-[560px] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden" : "mt-3")}
      role="tablist"
      aria-label="صور المنتج"
    >
      {slides.map((s, k) => (
        <button
          key={`${s.kind}-${s.url}-${k}`}
          type="button"
          role="tab"
          aria-selected={k === idx}
          aria-label={s.kind === "video" ? `فيديو ${k + 1}` : `صورة ${k + 1}`}
          onClick={() => select(k)}
          className={cn(
            "relative size-16 shrink-0 overflow-hidden rounded-xl border-2 transition-opacity focus-visible:outline-none focus-visible:ring-2",
            k === idx ? "border-[var(--primary)] opacity-100" : "border-transparent opacity-60 hover:opacity-100"
          )}
          style={{ background: "var(--muted)" }}
        >
          {s.kind === "image" ? (
            <Image src={s.url} alt="" fill sizes="64px" className="object-cover" />
          ) : (
            <>
              {s.poster ? <Image src={s.poster} alt="" fill sizes="64px" className="object-cover" /> : null}
              <span className="absolute inset-0 grid place-items-center bg-black/35 text-white">
                <Play className="size-5" aria-hidden="true" />
              </span>
            </>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className={cn(immersive && "lg:grid lg:grid-cols-[80px_1fr] lg:gap-3")}>
        {immersive ? thumbs : null}

        <div className="relative">
          <div
            ref={trackRef}
            className="hide-scrollbar relative flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-3xl border"
            style={{ background: "var(--muted)", borderColor: "var(--border)" }}
            role="group"
            aria-roledescription="carousel"
            aria-label={`صور ${name}`}
          >
            {slides.map((s, k) => (
              <div key={`${s.kind}-${s.url}-${k}`} className="relative aspect-[4/5] w-full shrink-0 snap-center sm:aspect-square lg:aspect-[4/5]" aria-roledescription="slide" aria-label={`${k + 1} من ${slides.length}`}>
                {s.kind === "image" ? (
                  <button
                    type="button"
                    onClick={() => openAt(k)}
                    onPointerMove={(e) => {
                      if (e.pointerType !== "mouse" || k !== idx) return;
                      const r = e.currentTarget.getBoundingClientRect();
                      setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
                    }}
                    onPointerLeave={() => setZoom(null)}
                    className="group absolute inset-0 block cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                    aria-label="عرض الصورة بملء الشاشة"
                  >
                    <Image src={s.url} alt={s.alt || name} fill priority={k === 0} sizes="(max-width:1024px) 100vw, 50vw" className="object-contain" />
                    {zoom && k === idx ? (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 hidden bg-no-repeat [@media(hover:hover)]:block"
                        style={{ backgroundImage: `url(${s.url})`, backgroundSize: "200%", backgroundPosition: `${zoom.x}% ${zoom.y}%`, backgroundColor: "var(--muted)" }}
                      />
                    ) : null}
                    <span className="absolute end-3 top-3 grid size-9 place-items-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true">
                      <ZoomIn className="size-4" />
                    </span>
                  </button>
                ) : (
                  <video
                    src={s.url}
                    poster={s.poster}
                    controls
                    playsInline
                    preload="none"
                    className="absolute inset-0 size-full bg-black object-contain"
                    aria-label={`فيديو ${name}`}
                  />
                )}
              </div>
            ))}
          </div>

          {slides.length > 1 ? (
            <>
              <button type="button" onClick={() => select(idx - 1)} disabled={idx === 0} aria-label="السابق" className="absolute end-2 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 lg:grid">
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => select(idx + 1)} disabled={idx === slides.length - 1} aria-label="التالي" className="absolute start-2 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 lg:grid">
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <p className="pointer-events-none absolute bottom-3 end-3 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-bold tabular-nums text-white lg:hidden" aria-live="polite">
                {idx + 1} / {slides.length}
              </p>
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5 lg:hidden" aria-hidden="true">
                {slides.map((_, k) => (
                  <span key={k} className={cn("h-1.5 rounded-full transition-all", k === idx ? "w-4 bg-white" : "w-1.5 bg-white/55")} />
                ))}
              </div>
            </>
          ) : null}
        </div>

        {!immersive ? thumbs : null}
      </div>

      <ImageLightbox
        images={imageSlides}
        index={lightboxIndex}
        open={lightbox}
        onClose={() => setLightbox(false)}
        onIndex={(i) => {
          const url = imageSlides[i]?.url;
          const k = slides.findIndex((s) => s.url === url);
          if (k >= 0) select(k);
        }}
        label={`صور ${name}`}
      />
    </>
  );
}
