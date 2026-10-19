"use client";

// ImageLightbox — عارض الصور بملء الشاشة على <dialog> أصلي يُفتح بـ showModal() فيعيش في الطبقة العليا (top layer)
// فلا يغطيه هيدر ولا شريط شراء ولا زر واتساب مهما كانت سياقات التكديس حوله. يُرسم داخل جذر المتجر (portal)
// ليرث ألوانه. يدعم التكبير بالقرص والنقر المزدوج، والسحب بين الصور، والأسهم وEscape، وإعادة التركيز لما قبله.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type LightboxImage = { url: string; alt?: string };

type Pt = { x: number; y: number };
const MAX_SCALE = 4;

export function ImageLightbox({
  images,
  index,
  open,
  onClose,
  onIndex,
  label = "عرض الصورة",
}: {
  images: LightboxImage[];
  index: number;
  open: boolean;
  onClose: () => void;
  onIndex: (i: number) => void;
  label?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [host, setHost] = useState<Element | null>(null);
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<{ d0: number; s0: number; start: Pt; v0: { s: number; x: number; y: number }; moved: boolean; t: number } | null>(null);
  const lastTap = useRef(0);
  const total = images.length;

  useLayoutEffect(() => {
    setHost(document.querySelector(".storefront") ?? document.body);
  }, []);

  const reset = useCallback(() => setView({ s: 1, x: 0, y: 0 }), []);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (total < 2) return;
      reset();
      onIndex((index + dir + total) % total);
    },
    [index, total, onIndex, reset]
  );

  // فتح/إغلاق الحوار الأصلي + قفل تمرير الصفحة
  useEffect(() => {
    const d = ref.current;
    if (!d || !host) return;
    if (open && !d.open) {
      d.showModal();
      reset();
      const html = document.documentElement;
      const prev = html.style.overflow;
      html.style.overflow = "hidden";
      return () => {
        html.style.overflow = prev;
        if (d.open) d.close();
      };
    }
    if (!open && d.open) d.close();
  }, [open, host, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // RTL: السهم الأيمن = السابق
      if (e.key === "ArrowRight") go(-1);
      if (e.key === "ArrowLeft") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  const clamp = (v: { s: number; x: number; y: number }) => {
    const s = Math.min(MAX_SCALE, Math.max(1, v.s));
    if (s === 1) return { s, x: 0, y: 0 };
    const lim = ((s - 1) * Math.min(window.innerWidth, window.innerHeight)) / 1.4;
    return { s, x: Math.max(-lim, Math.min(lim, v.x)), y: Math.max(-lim, Math.min(lim, v.y)) };
  };

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    gesture.current = {
      d0: pts.length > 1 ? Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) : 0,
      s0: view.s,
      start: { x: e.clientX, y: e.clientY },
      v0: view,
      moved: false,
      t: Date.now(),
    };
  };
  const onMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length > 1 && g.d0) {
      g.moved = true;
      const d = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      setView(clamp({ ...g.v0, s: (g.s0 * d) / g.d0 }));
    } else if (g.v0.s > 1) {
      g.moved = true;
      setView(clamp({ s: g.v0.s, x: g.v0.x + (e.clientX - g.start.x), y: g.v0.y + (e.clientY - g.start.y) }));
    } else if (Math.abs(e.clientX - g.start.x) > 8) {
      g.moved = true;
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (!g) return;
    if (pointers.current.size > 0) return;
    gesture.current = null;
    const dx = e.clientX - g.start.x;
    if (g.v0.s === 1 && view.s === 1 && Math.abs(dx) > 60 && Math.abs(e.clientY - g.start.y) < 80) {
      go(dx < 0 ? -1 : 1);
      return;
    }
    if (!g.moved && Date.now() - g.t < 300) {
      const now = Date.now();
      if (now - lastTap.current < 320) {
        lastTap.current = 0;
        setView(view.s > 1 ? { s: 1, x: 0, y: 0 } : clamp({ s: 2.5, x: (window.innerWidth / 2 - e.clientX) * 1.5, y: (window.innerHeight / 2 - e.clientY) * 1.5 }));
      } else lastTap.current = now;
    }
  };

  const cur = images[index];
  if (!host) return null;
  return createPortal(
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="clp-lightbox"
      dir="rtl"
    >
      {open && cur ? (
        <>
          <button type="button" onClick={onClose} className="clp-lightbox-close" aria-label="إغلاق">
            <X className="size-5" aria-hidden="true" />
          </button>
          {total > 1 ? (
            <>
              <button type="button" onClick={() => go(-1)} className="clp-lightbox-nav start-3" aria-label="السابق">
                <ChevronRight className="size-6" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => go(1)} className="clp-lightbox-nav end-3" aria-label="التالي">
                <ChevronLeft className="size-6" aria-hidden="true" />
              </button>
              <p className="clp-lightbox-count" dir="ltr" aria-live="polite">
                {index + 1} / {total}
              </p>
            </>
          ) : null}
          <div className="clp-lightbox-stage" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cur.url}
              alt={cur.alt || ""}
              draggable={false}
              style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})`, transition: gesture.current ? "none" : "transform 0.2s ease" }}
            />
          </div>
        </>
      ) : null}
    </dialog>,
    host
  );
}
