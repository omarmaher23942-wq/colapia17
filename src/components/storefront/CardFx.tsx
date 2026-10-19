"use client";

// CardFx — مستمع واحد لكل بطاقات المتجر (لا مكوّن ولا إعادة رسم لكل بطاقة):
// 1) يضع data-in على البطاقات الظاهرة فقط، فالإطار الزئبقي المتحرك لا يعمل خارج الشاشة (بطارية ومعالج).
// 2) أسلوب «سينمائي»: ميل ثلاثي الأبعاد ولمعة وعمق للصورة مع المؤشر الدقيق، عبر متغيرات CSS فقط.
// كل شيء يتوقف لمن طلب تقليل الحركة، والشكل كله في blueprint/design.ts (cardFxRules).
import { useEffect } from "react";

const MAX_DEG = 6;

export function CardFx({ style }: { style: "mercury" | "cinematic" | "glow" | "simple" }) {
  useEffect(() => {
    if (style !== "mercury" && style !== "cinematic") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.querySelector(".storefront");
    if (!root) return;

    // ─── الظهور في الشاشة (للإطار المتحرك)
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;
    if (style === "mercury" && "IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) e.target.setAttribute("data-in", "");
            else e.target.removeAttribute("data-in");
          }
        },
        { rootMargin: "80px 0px" }
      );
      const seen = new WeakSet<Element>();
      const scan = () => root.querySelectorAll(".s-card").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io!.observe(el);
      });
      scan();
      let queued = 0;
      mo = new MutationObserver(() => {
        if (queued) return;
        queued = requestAnimationFrame(() => {
          queued = 0;
          scan();
        });
      });
      mo.observe(root, { childList: true, subtree: true });
    }

    // ─── الميل السينمائي
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let active: HTMLElement | null = null;
    let frame = 0;
    let last: PointerEvent | null = null;
    const reset = (el: HTMLElement) => {
      el.classList.remove("is-tilting");
      for (const k of ["--rx", "--ry", "--px", "--py"]) el.style.removeProperty(k);
      el.style.setProperty("--go", "0");
    };
    const paint = () => {
      frame = 0;
      if (!active || !last) return;
      const r = active.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (last.clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (last.clientY - r.top) / r.height));
      const s = active.style;
      s.setProperty("--ry", `${((x - 0.5) * MAX_DEG * 2).toFixed(2)}deg`);
      s.setProperty("--rx", `${((0.5 - y) * MAX_DEG * 2).toFixed(2)}deg`);
      s.setProperty("--px", (x - 0.5).toFixed(3));
      s.setProperty("--py", (y - 0.5).toFixed(3));
      s.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
      s.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
      s.setProperty("--go", "1");
    };
    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(".s-card") as HTMLElement | null;
      if (el !== active) {
        if (active) reset(active);
        active = el;
        active?.classList.add("is-tilting");
      }
      if (!active) return;
      last = e;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onLeave = () => {
      if (active) reset(active);
      active = null;
    };
    const tilt = style === "cinematic" && fine;
    if (tilt) {
      root.addEventListener("pointermove", onMove as EventListener, { passive: true });
      root.addEventListener("pointerleave", onLeave);
      window.addEventListener("blur", onLeave);
    }

    return () => {
      io?.disconnect();
      mo?.disconnect();
      if (tilt) {
        root.removeEventListener("pointermove", onMove as EventListener);
        root.removeEventListener("pointerleave", onLeave);
        window.removeEventListener("blur", onLeave);
      }
      if (frame) cancelAnimationFrame(frame);
    };
  }, [style]);
  return null;
}
