"use client";

// HeroSlides — صور الواجهة الجانبية (حتى 5): الصورة الأولى تُرسم من الخادم فوراً، والتبديل بعدها كل بضع ثوانٍ،
// يتوقف عند المرور أو التركيز أو تقليل الحركة، ونقاط للتنقل. بلا أي حركة تخفي المحتوى.
import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type Img = { url: string; alt: string; focalX: number; focalY: number };

export function HeroSlides({ images, fallbackAlt, autoplayMs = 5000 }: { images: Img[]; fallbackAlt: string; autoplayMs?: number }) {
  const list = images.slice(0, 5);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  useEffect(() => {
    if (list.length < 2 || paused || reduced) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % list.length), Math.max(2500, autoplayMs));
    return () => window.clearInterval(t);
  }, [list.length, paused, reduced, autoplayMs]);

  return (
    <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="s-hero-media s-media relative !aspect-[4/5] !p-0 sm:!aspect-[5/6]" aria-roledescription="carousel" aria-label="صور المتجر">
        {list.map((im, k) => (
          <Image
            key={im.url}
            src={im.url}
            alt={im.alt || fallbackAlt}
            fill
            priority={k === 0}
            sizes="(max-width: 768px) 100vw, 50vw"
            aria-hidden={k !== i}
            className={cn("!absolute object-cover transition-opacity duration-700", k === i ? "opacity-100" : "opacity-0")}
            style={{ objectPosition: `${Math.round(im.focalX * 100)}% ${Math.round(im.focalY * 100)}%` }}
          />
        ))}
      </div>
      {list.length > 1 ? (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1" role="tablist" aria-label="اختيار الصورة">
          {list.map((_, k) => (
            <button key={k} type="button" role="tab" aria-selected={k === i} aria-label={`الصورة ${k + 1}`} onClick={() => setI(k)} className="grid size-6 place-items-center focus-visible:outline-none">
              <span className={cn("block h-1.5 rounded-full bg-white shadow transition-all", k === i ? "w-5 opacity-100" : "w-1.5 opacity-60")} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
