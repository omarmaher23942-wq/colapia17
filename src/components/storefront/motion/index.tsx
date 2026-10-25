// flyToCart: صورة المنتج تطير إلى أيقونة السلة (تحترم تقليل الحركة، وتحتاج data-cart-icon في الهيدر).
import { animate, type DOMKeyframesDefinition } from "motion/react";
import { EASE } from "@/lib/motion";

const DEFAULT_CART_ICON_SELECTOR = "[data-cart-icon]";

/**
 * flyToCart — يُحرّك صورة مصغّرة من المصدر إلى أيقونة السلة.
 *
 * مصادر الصورة (بالأولوية):
 *  1. fromEl.dataset.flySource (خاصية data-fly-source على العنصر)
 *  2. imgUrl المُمرَّر
 *  3. أول <img> داخل fromEl
 *
 * هدف السلة: أول عنصر بـ [data-cart-icon] (يجب أن يضيفه Header).
 *
 * آمن تماماً: يعمل مع reduced-motion (يتخطى)، بدون target (يتخطى)،
 * ونظيف الذاكرة (يحذف العنصر المتحرك بعد الانتهاء).
 */
export function flyToCart(fromEl: HTMLElement | null, imgUrl?: string) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!fromEl) return;

  const target = document.querySelector<HTMLElement>(
    DEFAULT_CART_ICON_SELECTOR
  );
  if (!target) return;

  const sourceUrl =
    imgUrl ||
    fromEl.dataset.flySource ||
    fromEl.querySelector<HTMLImageElement>("img")?.currentSrc ||
    fromEl.querySelector<HTMLImageElement>("img")?.src;
  if (!sourceUrl) return;

  // احترام اتجاه الصفحة: نقطة الانطلاق والوصول تُحسبان لاحقاً.
  const a = fromEl.getBoundingClientRect();
  const b = target.getBoundingClientRect();

  // حجم الانطلاق ≈ الحجم المرئي للصورة المصدرية.
  const startSize = Math.max(48, Math.min(120, a.width, a.height));
  const endSize = 32;

  const img = document.createElement("img");
  img.src = sourceUrl;
  img.alt = "";
  img.decoding = "async";
  img.loading = "eager";
  Object.assign(img.style, {
    position: "fixed",
    left: `${a.left + (a.width - startSize) / 2}px`,
    top: `${a.top + (a.height - startSize) / 2}px`,
    width: `${startSize}px`,
    height: `${startSize}px`,
    objectFit: "cover",
    borderRadius: "16px",
    zIndex: "9999",
    pointerEvents: "none",
    willChange: "transform, opacity, left, top, width, height",
    boxShadow: "0 8px 24px rgba(0,0,0,.35)",
  });
  document.body.appendChild(img);

  const targetX = b.left + b.width / 2 - endSize / 2;
  const targetY = b.top + b.height / 2 - endSize / 2;

  const keyframes: DOMKeyframesDefinition = {
    left: [`${a.left + (a.width - startSize) / 2}px`, `${targetX}px`],
    top: [`${a.top + (a.height - startSize) / 2}px`, `${targetY}px`],
    width: [`${startSize}px`, `${endSize}px`],
    height: [`${startSize}px`, `${endSize}px`],
    borderRadius: ["16px", "999px"],
    opacity: [1, 1, 0.85, 0],
    rotate: [0, 8],
  };

  animate(img, keyframes, { duration: 0.75, ease: EASE.brand }).then(() => {
    img.remove();
    // نبضة على أيقونة السلة للإشارة إلى نجاح الإضافة.
    target.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.35)" },
        { transform: "scale(1)" },
      ],
      { duration: 350, easing: "cubic-bezier(.22,1,.36,1)" }
    );
  });
}

