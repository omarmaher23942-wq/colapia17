"use client";

// CartDrawer — السلة على <dialog> أصلي (الطبقة العليا) عبر SheetDialog: لا تتداخل مع نصوص الصفحة ولا أشرطتها الثابتة،
// ومحاصرة التركيز والإغلاق بـ Esc والنقر خارجها من المتصفح نفسه. درج جانبي على الحاسوب وورقة سفلية على الموبايل.
// - شريط الشحن المجاني، وحالة فارغة، وأهداف لمس ≥ 44px.
import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ShoppingBag, ArrowLeft } from "lucide-react";
import { useCart } from "@/store/cart";
import { useCopy } from "./StoreProvider";
import { CartLines } from "./CartView";
import { CartNotices, CartTotals, CrossSell, FreeShippingMeter, useCartLive } from "./CartLive";
import { CartActions } from "./CartActions";
import { SheetDialog } from "./SheetDialog";
import { formatEgp } from "@/lib/money";
import { cn } from "@/lib/utils";

const SW = 1.75;

export function CartDrawer() {
  const isOpen = useCart((s) => s.isOpen);
  const close = useCart((s) => s.close);
  const items = useCart((s) => s.items);
  const t = useCopy();
  // التحقق الحي من الخادم عند فتح السلة فقط.
  const live = useCartLive(isOpen);

  const subtotal = items.reduce((a, i) => a + i.unitPiasters * i.qty, 0);
  const count = items.reduce((a, i) => a + i.qty, 0);
  const total = live.data?.quote?.afterDiscount ?? subtotal;
  const blocked = live.notices.some((n) => n.removable);

  // أي انتقال لصفحة أخرى (الدفع مثلاً) يغلق الدرج: لا يبقى فوق الصفحة الجديدة.
  const pathname = usePathname();
  useEffect(() => close(), [pathname, close]);

  const footer =
    items.length > 0 ? (
      <div className="space-y-3">
        <CartTotals live={live} localSubtotal={subtotal} />
        <div className="flex items-baseline justify-between border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <span className="text-sm opacity-70">المجموع بعد الخصم</span>
          <span className="font-mono text-xl font-black tabular-nums">{formatEgp(total)}</span>
        </div>
        {blocked ? <p className="text-xs font-bold text-danger">أزيلوا المنتجات غير المتاحة للمتابعة</p> : null}
        <CartActions totalPiasters={total} />
        <Link href="/checkout" onClick={close} aria-disabled={blocked} tabIndex={blocked ? -1 : undefined} className={cn("s-btn h-12 w-full text-sm", blocked && "pointer-events-none opacity-50")}>
          {t("checkout")}
          <ArrowLeft className="size-5" strokeWidth={SW} aria-hidden="true" />
        </Link>
        <button type="button" onClick={close} className="min-h-11 w-full text-center text-sm font-bold opacity-70 transition-opacity hover:opacity-100">
          {t("continueShopping")}
        </button>
      </div>
    ) : null;

  return (
    <SheetDialog open={isOpen} onClose={close} title={count > 0 ? `${t("cartTitle")} (${count})` : t("cartTitle")} side="end" footer={footer}>
      {items.length === 0 ? (
        <div className="grid min-h-48 place-items-center text-center">
          <div>
            <ShoppingBag className="mx-auto mb-4 size-14 opacity-25" strokeWidth={SW} aria-hidden="true" />
            <p className="font-bold">{t("emptyCart")}</p>
            <button type="button" onClick={close} className="s-btn mt-5">
              {t("continueShopping")}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <FreeShippingMeter data={live.data} localSubtotal={subtotal} />
          <CartNotices notices={live.notices} dismiss={live.dismiss} />
          <CartLines data={live.data} onNavigate={close} />
          <CrossSell data={live.data} onNavigate={close} />
        </div>
      )}
    </SheetDialog>
  );
}
