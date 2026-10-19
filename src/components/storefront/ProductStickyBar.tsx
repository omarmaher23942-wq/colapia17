"use client";

// ProductStickyBar — شريط الشراء الثابت (موبايل). يظهر حين تغادر أزرار الشراء الأصلية الشاشة، ويقرأ الاختيار الحالي
// (التركيبة والكمية والسعر) من حالة صفحة المنتج المشتركة (usePdp) لا من سمات DOM. يعلّم <html data-sticky-bar="1">
// فيختفي زر واتساب العائم تحته، ويرتفع فوق الشريط السفلي عبر --clp-bottom-offset. غير ظاهر = inert فلا يلتقط التركيز.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useCopy, useStore } from "./StoreProvider";
import { formatEgp } from "@/lib/money";
import { flyToCart } from "./motion";
import { useCart } from "@/store/cart";
import { usePdp } from "@/store/pdp";
import { cn } from "@/lib/utils";

export function ProductStickyBar() {
  const { conversion } = useStore();
  const s = usePdp((st) => st.s);
  const setVisible = usePdp((st) => st.setVisible);
  const add = useCart((st) => st.add);
  const items = useCart((st) => st.items);
  const closeCart = useCart((st) => st.close);
  const router = useRouter();
  const t = useCopy();
  const enabled = conversion.stickyAddToCart !== false;
  const shown = enabled && !!s && !s.buttonsVisible;

  // مراقبة صف أزرار الشراء: يُعد «خارج الشاشة» حين يمر المستخدم فوقه فقط (يعلو عن الأعلى).
  useEffect(() => {
    const target = document.querySelector<HTMLElement>("[data-purchase-block]");
    if (!target || !enabled) return;
    const io = new IntersectionObserver(([e]) => e && setVisible(e.isIntersecting || e.boundingClientRect.top > 0), { threshold: 0 });
    io.observe(target);
    return () => io.disconnect();
  }, [enabled, setVisible, s?.productId]);

  useEffect(() => {
    const el = document.documentElement;
    if (shown) el.dataset.stickyBar = "1";
    else delete el.dataset.stickyBar;
    return () => {
      delete el.dataset.stickyBar;
    };
  }, [shown]);

  if (!enabled || !s) return null;

  const line = () => ({
    productId: s.productId,
    variantId: s.variantId || undefined,
    slug: s.slug,
    name: s.name,
    imageUrl: s.image,
    unitPiasters: s.price,
    variantLabel: s.variantLabel || undefined,
    maxQty: s.stock,
  });
  const guard = () => {
    if (!s.needsVariant) return true;
    toast.error(`يلزم اختيار ${s.optionNames.join(" و")} من الصفحة`);
    document.querySelector("[data-variant-picker]")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  };

  return (
    <div
      className={cn("fixed inset-x-3 z-40 transition-all duration-300 md:hidden", shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0")}
      style={{ bottom: "calc(0.75rem + var(--clp-bottom-offset, 0px) + env(safe-area-inset-bottom, 0px))" }}
      inert={!shown}
    >
      <div className="flex items-center gap-2 rounded-2xl border p-2 shadow-2xl backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--background) 92%, transparent)", borderColor: "var(--border)" }}>
        <div className="min-w-0 flex-1 ps-1">
          <p className="truncate text-[12px] font-bold opacity-70">{s.variantLabel || s.name}</p>
          <p className="text-sm font-black tabular-nums" style={{ color: "var(--primary)" }}>
            {formatEgp(s.price * s.qty)}
          </p>
        </div>
        <button
          type="button"
          disabled={s.out}
          onClick={(e) => {
            if (s.out || !guard()) return;
            add(line(), s.qty);
            flyToCart(e.currentTarget, s.image);
            toast.success("تمت الإضافة للسلة");
          }}
          className="grid size-11 shrink-0 place-items-center rounded-xl border-2 transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40"
          style={{ borderColor: "var(--border)" }}
          aria-label={t("addToCart")}
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={s.out}
          onClick={() => {
            if (s.out || !guard()) return;
            if (!items.some((x) => x.productId === s.productId && (x.variantId ?? "") === s.variantId)) add(line(), s.qty);
            closeCart();
            router.push("/checkout");
          }}
          className="s-btn !min-h-11 shrink-0 text-xs"
        >
          <span>{s.out ? t("soldOut") : t("buyNow")}</span>
          <ArrowLeft className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
