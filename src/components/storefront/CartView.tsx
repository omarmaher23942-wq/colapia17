"use client";

// CartView — صفحة /cart: أسطر السلة (يمين) وملخص ثابت (يسار) على lg. الأرقام من الخادم (CartLive): توفر وسعر حالي وخصم الكمية
// والخصومات التلقائية وتقدّم الشحن المجاني، مع «احفظ لاحقاً» و«أكملوا الإطلالة».
import Link from "next/link";
import Image from "next/image";
import { useSyncExternalStore } from "react";
import { Bookmark, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart, itemKey, lineCap } from "@/store/cart";
import { useCopy } from "./StoreProvider";
import { formatEgp } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CartNotices, CartTotals, CrossSell, FreeShippingMeter, useCartLive, useSaveForLater } from "./CartLive";
import type { CartCheckResult } from "@/server/cart-check";

const SW = 1.75;

const noopSubscribe = () => () => {};
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function useCartTotals() {
  const items = useCart((s) => s.items);
  const subtotal = items.reduce((a, i) => a + i.unitPiasters * i.qty, 0);
  const count = items.reduce((a, i) => a + i.qty, 0);
  return { items, subtotal, count };
}

export function CartLines({
  onNavigate,
  large = false,
  data = null,
}: {
  onNavigate?: () => void;
  large?: boolean;
  data?: CartCheckResult | null;
}) {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const saveLater = useSaveForLater();

  // خصم الكمية/الطقم لكل سطر من حساب الخادم (السطر المدموج بالمنتج والتركيبة).
  const serverLine = (i: (typeof items)[number]) => {
    const same = items.filter((x) => x.productId === i.productId && (x.variantId ?? "") === (i.variantId ?? ""));
    if (same.length !== 1) return null;
    return data?.quote?.lines.find((l) => !l.isGift && l.productId === i.productId && (l.variantId ?? "") === (i.variantId ?? "")) ?? null;
  };

  return (
    <ul className={cn("space-y-4", large && "space-y-0 divide-y")} style={large ? { borderColor: "var(--border)" } : undefined} dir="rtl">
      {items.map((i) => {
        const k = itemKey(i);
        const atMax = i.qty >= lineCap(i);
        const sl = serverLine(i);
        const gross = i.unitPiasters * i.qty;
        const net = sl ? sl.net : gross;
        const off = sl && sl.net < gross;
        const unavailable = data?.lines.find((l) => l.key === k && (l.status === "removed" || l.status === "unavailable" || l.status === "out_of_stock"));
        return (
          <li key={k} className={cn("flex gap-3", large && "py-4", unavailable && "opacity-60")} style={large ? { borderColor: "var(--border)" } : undefined}>
            <Link href={`/p/${encodeURIComponent(i.slug)}`} onClick={onNavigate} className={cn("relative shrink-0 overflow-hidden rounded-xl", large ? "size-24" : "size-20")} style={{ background: "var(--muted)" }}>
              {i.imageUrl ? <Image src={i.imageUrl} alt={i.name} fill sizes={large ? "96px" : "80px"} className="object-cover" /> : null}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={`/p/${encodeURIComponent(i.slug)}`} onClick={onNavigate} className="line-clamp-2 text-sm font-black leading-snug transition-opacity hover:opacity-80">
                {i.name}
              </Link>
              {i.variantLabel ? <p className="mt-0.5 text-[11px] opacity-70">{i.variantLabel}</p> : null}
              {off ? <p className="mt-0.5 text-[11px] font-bold text-success">{sl!.reason === "bundle" ? "خصم الطقم" : "خصم الكمية"} · وفّرتم {formatEgp(gross - net)}</p> : null}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-2">
                <div className="flex items-center overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
                  <button type="button" className="grid size-9 place-items-center transition-colors hover:bg-[var(--muted)] disabled:opacity-40" onClick={() => setQty(k, i.qty - 1)} aria-label={`تقليل كمية ${i.name}`}>
                    <Minus strokeWidth={SW} className="size-3.5" aria-hidden="true" />
                  </button>
                  <span className="w-8 text-center font-mono text-sm font-bold tabular-nums" aria-live="polite">{i.qty}</span>
                  <button type="button" className="grid size-9 place-items-center transition-colors hover:bg-[var(--muted)] disabled:opacity-40" onClick={() => setQty(k, i.qty + 1)} disabled={atMax} aria-label={`زيادة كمية ${i.name}`}>
                    <Plus strokeWidth={SW} className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
                <span className="text-end font-mono text-sm font-black tabular-nums">
                  {off ? <span className="me-1.5 text-[11px] font-medium line-through opacity-50">{formatEgp(gross)}</span> : null}
                  {formatEgp(net)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1">
                <button type="button" onClick={() => saveLater(k, i.slug)} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11.5px] font-bold opacity-70 transition-opacity hover:opacity-100">
                  <Bookmark className="size-3.5" strokeWidth={SW} aria-hidden="true" /> احفظ لاحقاً
                </button>
                <button type="button" onClick={() => remove(k)} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11.5px] font-bold text-danger transition-colors hover:bg-danger/10" aria-label={`حذف ${i.name}`}>
                  <Trash2 strokeWidth={SW} className="size-3.5" aria-hidden="true" /> حذف
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function EmptyCart({ onAction }: { onAction?: () => void }) {
  const t = useCopy();
  return (
    <div className="grid place-items-center py-12 text-center" dir="rtl">
      <ShoppingBag strokeWidth={SW} className="mx-auto mb-3 size-14 opacity-25" aria-hidden="true" />
      <p className="text-base font-black">{t("emptyCart")}</p>
      {onAction ? (
        <button type="button" onClick={onAction} className="s-btn mt-5">
          {t("continueShopping")}
        </button>
      ) : (
        <Link href="/" className="s-btn mt-5">
          {t("continueShopping")}
        </Link>
      )}
    </div>
  );
}

export function CartView() {
  const hydrated = useHydrated();
  const t = useCopy();
  const { items, subtotal, count } = useCartTotals();
  const live = useCartLive(hydrated);

  if (!hydrated) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]" aria-busy="true">
        <div className="h-64 animate-pulse rounded-3xl bg-[var(--muted)]" />
        <div className="h-48 animate-pulse rounded-3xl bg-[var(--muted)]" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-3xl border p-8" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <EmptyCart />
      </div>
    );
  }

  const q = live.data?.quote ?? null;
  const total = q ? q.afterDiscount : subtotal;
  const blocked = Boolean(live.notices.some((n) => n.removable));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]" dir="rtl">
      <div className="space-y-5">
        <CartNotices notices={live.notices} dismiss={live.dismiss} />
        <div className="rounded-3xl border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <CartLines large data={live.data} />
        </div>
        <CrossSell data={live.data} />
      </div>
      <aside className="h-fit space-y-4 rounded-3xl border p-5 lg:sticky lg:top-24" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <h2 className="font-heading text-lg font-black">ملخص السلة</h2>
        <FreeShippingMeter data={live.data} localSubtotal={subtotal} />
        <CartTotals live={live} localSubtotal={subtotal} />
        <div className="flex justify-between border-t pt-4 text-base font-black" style={{ borderColor: "var(--border)" }}>
          <span>المجموع بعد الخصم ({count})</span>
          <span className="font-mono tabular-nums">{formatEgp(total)}</span>
        </div>
        {blocked ? <p className="text-xs font-bold text-danger">أزيلوا المنتجات غير المتاحة للمتابعة</p> : null}
        <Link href="/checkout" aria-disabled={blocked} className={cn("s-btn h-12 w-full text-sm", blocked && "pointer-events-none opacity-50")}>
          {t("checkout")}
        </Link>
        <Link href="/" className="block text-center text-sm font-bold opacity-60 transition-opacity hover:opacity-100">
          {t("continueShopping")}
        </Link>
      </aside>
    </div>
  );
}
