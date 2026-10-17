"use client";

// CartDrawer — يفتح من الـ end (يسار في RTL) لتوافق RTL.
// - Free shipping progress bar تفاعلي.
// - Empty state أنيقة.
// - Touch targets ≥ 44px.
import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { X, ShoppingBag, ArrowLeft } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCart } from "@/store/cart";
import { useCopy } from "./StoreProvider";
import { CartLines } from "./CartView";
import { CartNotices, CartTotals, CrossSell, FreeShippingMeter, useCartLive } from "./CartLive";
import { formatEgp } from "@/lib/money";
import { cn } from "@/lib/utils";

const SW = 1.75;

export function CartDrawer() {
  const isOpen = useCart((s) => s.isOpen);
  const close = useCart((s) => s.close);
  const items = useCart((s) => s.items);
  const t = useCopy();
  const reduce = useReducedMotion();
  // التحقق الحي من الخادم عند فتح السلة فقط.
  const live = useCartLive(isOpen);

  const subtotal = items.reduce((a, i) => a + i.unitPiasters * i.qty, 0);
  const count = items.reduce((a, i) => a + i.qty, 0);
  const total = live.data?.quote?.afterDiscount ?? subtotal;
  const blocked = live.notices.some((n) => n.removable);

  // أي انتقال لصفحة أخرى (الدفع مثلاً) يغلق الدرج: لا يبقى فوق الصفحة الجديدة.
  const pathname = usePathname();
  useEffect(() => close(), [pathname, close]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, close]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
            onClick={close}
            aria-hidden="true"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={t("cartTitle")}
            className="fixed inset-y-0 end-0 z-50 flex w-[92vw] max-w-md flex-col border-s shadow-2xl"
            style={{
              background: "var(--background)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
            initial={reduce ? { opacity: 0 } : { x: "-100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            dir="rtl"
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-center justify-between border-b p-4"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <ShoppingBag
                  className="size-5"
                  style={{ color: "var(--primary)" }}
                  strokeWidth={SW}
                  aria-hidden="true"
                />
                <h2 className="text-base font-black">{t("cartTitle")}</h2>
                {count > 0 ? (
                  <span
                    className="rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 12%, transparent)",
                      color: "var(--primary)",
                    }}
                  >
                    {count}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="إغلاق"
                className="grid size-11 place-items-center rounded-xl transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2"
              >
                <X className="size-5" strokeWidth={SW} aria-hidden="true" />
              </button>
            </div>

            {/* Items + live summary */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {items.length === 0 ? (
                <div className="grid h-full place-items-center text-center">
                  <div>
                    <ShoppingBag className="mx-auto mb-4 size-14 opacity-25" strokeWidth={SW} aria-hidden="true" />
                    <p className="font-bold">{t("emptyCart")}</p>
                    <button type="button" onClick={close} className="s-btn mt-5">
                      {t("continueShopping")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <FreeShippingMeter data={live.data} localSubtotal={subtotal} />
                  <CartNotices notices={live.notices} dismiss={live.dismiss} />
                  <CartLines data={live.data} onNavigate={close} />
                  <CrossSell data={live.data} onNavigate={close} />
                </>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 ? (
              <div className="shrink-0 space-y-3 border-t p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                <CartTotals live={live} localSubtotal={subtotal} />
                <div className="flex items-baseline justify-between border-t pt-3" style={{ borderColor: "var(--border)" }}>
                  <span className="text-sm opacity-70">المجموع بعد الخصم</span>
                  <span className="font-mono text-xl font-black tabular-nums">{formatEgp(total)}</span>
                </div>
                {blocked ? <p className="text-xs font-bold text-danger">أزيلوا المنتجات غير المتاحة للمتابعة</p> : null}
                <Link href="/checkout" onClick={close} aria-disabled={blocked} className={cn("s-btn h-12 w-full text-sm", blocked && "pointer-events-none opacity-50")}>
                  {t("checkout")}
                  <ArrowLeft className="size-5" strokeWidth={SW} aria-hidden="true" />
                </Link>
                <button type="button" onClick={close} className="w-full text-center text-sm font-bold opacity-60 transition-opacity hover:opacity-100">
                  {t("continueShopping")}
                </button>
              </div>
            ) : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}