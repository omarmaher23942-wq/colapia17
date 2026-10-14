"use client";

// HeroVideo — خلفية فيديو لواجهة المتجر بشروط الأداء أولاً:
//  1) صورة الغلاف (poster) تُرسم فوراً من الخادم، وهي ما يقيسه LCP، فالفيديو لا يؤخر الظهور أبداً.
//  2) الفيديو لا يبدأ تحميله إلا بعد اكتمال تحميل الصفحة وخمول المتصفح، وبعد أن تظهر الواجهة في الشاشة.
//  3) لا يُحمَّل إطلاقاً مع توفير البيانات أو اتصال 2G/3G أو تفضيل تقليل الحركة: تبقى صورة الغلاف.
//  4) صامت ومتكرر وinline، ويظهر بتلاشٍ ناعم عند أول إطار جاهز، ويتوقف إن خرجت الواجهة من الشاشة (توفير بطارية).
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type NetInfo = { saveData?: boolean; effectiveType?: string };

function mayLoadVideo(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const c = (navigator as Navigator & { connection?: NetInfo }).connection;
  if (c?.saveData) return false;
  if (c?.effectiveType && /(^|-)(2g|3g)$/.test(c.effectiveType)) return false;
  return true;
}

export function HeroVideo({ src, className }: { src: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [load, setLoad] = useState(false);
  const [ready, setReady] = useState(false);

  // بعد التحميل والخمول وظهور الواجهة في الشاشة فقط.
  useEffect(() => {
    if (!mayLoadVideo()) return;
    let cancelled = false;
    let io: IntersectionObserver | null = null;
    const start = () => {
      if (cancelled || !box.current) return;
      io = new IntersectionObserver(
        ([e]) => {
          if (!e) return;
          if (e.isIntersecting) setLoad(true);
          const v = video.current;
          if (v) e.isIntersecting ? void v.play().catch(() => undefined) : v.pause();
        },
        { threshold: 0.15 },
      );
      io.observe(box.current);
    };
    const idle = () => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (ric) ric(start, { timeout: 2500 });
      else window.setTimeout(start, 1200);
    };
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", idle);
      io?.disconnect();
    };
  }, []);

  const type = /\.webm(\?|$)/i.test(src) ? "video/webm" : /\.m3u8(\?|$)/i.test(src) ? undefined : "video/mp4";
  return (
    <div ref={box} aria-hidden="true" className={cn("pointer-events-none absolute inset-0", className)}>
      {load ? (
        <video
          ref={video}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          disablePictureInPicture
          onCanPlay={() => setReady(true)}
          className={cn("size-full object-cover transition-opacity duration-1000", ready ? "opacity-100" : "opacity-0")}
        >
          <source src={src} type={type} />
        </video>
      ) : null}
    </div>
  );
}
