"use client";

// AttentionCenter — جرس اللوحة: «ما يحتاج انتباهك» الآن (من أعداد حقيقية في قاعدة المتجر)،
// ثم «وصل أثناء فتح اللوحة» (الطلبات الجديدة على هذا الجهاز). كل بند رابط مباشر لمكان حلّه.
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Bell,
  CheckCircle2,
  ChevronLeft,
  Layers,
  PackageMinus,
  PackageX,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { governorateName } from "@/lib/egypt";
import { arCount, NOUN } from "@/lib/format";
import type { AttentionCounts } from "@/server/repos/attention";
import { useDashboardPulse } from "./DashboardPulse";

type Tone = "nova" | "warn" | "bad" | "ok";

type Item = {
  key: string;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  chip: string;
  desc: string;
  href: string;
};

const TONE: Record<Tone, string> = {
  nova: "bg-nova/12 text-nova-2",
  warn: "bg-warn/12 text-warn",
  bad: "bg-bad/12 text-bad",
  ok: "bg-ok/12 text-ok",
};

/** بنود الانتباه بالترتيب: المال والعملاء أولاً، ثم المخزون، ثم فرص البيع. */
export function attentionItems(c: AttentionCounts): Item[] {
  const items: Item[] = [];
  if (c.newOrders > 0)
    items.push({
      key: "new",
      icon: ShoppingCart,
      tone: "nova",
      title: "طلبات بانتظار التأكيد",
      chip: arCount(c.newOrders, NOUN.order),
      desc: "أكّد الطلب ليطمئن العميل أن طلبه وصل ويبدأ التجهيز.",
      href: "/dashboard/orders?status=new",
    });
  if (c.receipts > 0)
    items.push({
      key: "receipts",
      icon: Receipt,
      tone: "warn",
      title: "إيصالات تحويل للمراجعة",
      chip: arCount(c.receipts, NOUN.receipt),
      desc: "طابق المبلغ في محفظتك أو حسابك، ثم أكّد الدفع أو ارفضه.",
      href: "/dashboard/orders?payment=under_review",
    });
  if (c.pendingReviews > 0)
    items.push({
      key: "reviews",
      icon: Star,
      tone: "nova",
      title: "تقييمات بانتظار اعتمادك",
      chip: arCount(c.pendingReviews, NOUN.review),
      desc: "التقييم لا يظهر في متجرك قبل أن تعتمده.",
      href: "/dashboard/reviews",
    });
  if (c.outOfStock > 0)
    items.push({
      key: "out",
      icon: PackageX,
      tone: "bad",
      title: "نفد المخزون",
      chip: arCount(c.outOfStock, NOUN.product),
      desc: "يراها العملاء «نفدت الكمية». حدّث الكمية أو أخفِ المنتج.",
      href: "/dashboard/products?status=low_stock",
    });
  if (c.variantsOut > 0)
    items.push({
      key: "variants",
      icon: Layers,
      tone: "warn",
      title: "نفد مقاس أو لون",
      chip: arCount(c.variantsOut, NOUN.product),
      desc: "تركيبة واحدة على الأقل نفدت بينما بقية المنتج متاحة.",
      href: "/dashboard/products",
    });
  if (c.lowStock > 0)
    items.push({
      key: "low",
      icon: PackageMinus,
      tone: "warn",
      title: "مخزون منخفض",
      chip: arCount(c.lowStock, NOUN.product),
      desc: "بقيت 3 قطع أو أقل. جهّز الكمية قبل أن تنفد.",
      href: "/dashboard/products?status=low_stock",
    });
  if (c.abandoned > 0)
    items.push({
      key: "carts",
      icon: ShoppingBag,
      tone: "ok",
      title: "سلات متروكة يمكن استرجاعها",
      chip: arCount(c.abandoned, NOUN.cart),
      desc: "عملاء كتبوا رقمهم ولم يكملوا الطلب خلال 7 أيام. راسلهم على واتساب.",
      href: "/dashboard#abandoned",
    });
  return items;
}

/** ما يُحسب في رقم الجرس: ما ينتظر قرار التاجر الآن (لا المخزون ولا الفرص). */
export function urgentCount(c: AttentionCounts): number {
  return c.ordersToHandle + c.pendingReviews;
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "الآن";
  if (mins < 60) return mins === 1 ? "منذ دقيقة" : mins === 2 ? "منذ دقيقتين" : `منذ ${mins} ${mins <= 10 ? "دقائق" : "دقيقة"}`;
  const h = Math.round(mins / 60);
  if (h < 24) return h === 1 ? "منذ ساعة" : h === 2 ? "منذ ساعتين" : `منذ ${h} ${h <= 10 ? "ساعات" : "ساعة"}`;
  return new Date(iso).toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "short" });
}

export function AttentionCenter() {
  const { counts, ready, arrivals, unseenArrivals, markArrivalsSeen, clearArrivals } = useDashboardPulse();
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const panelId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const items = attentionItems(counts);
  const urgent = ready ? urgentCount(counts) : 0;
  const badge = urgent + unseenArrivals;

  useEffect(() => {
    if (!open) return;
    markArrivalsSeen();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open, markArrivalsSeen]);

  const label = badge > 0 ? `ما يحتاج انتباهك، ${badge} بنود` : "ما يحتاج انتباهك";

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        title="ما يحتاج انتباهك"
        className="relative grid size-10 place-items-center rounded-xl text-ink-2/80 transition-colors hover:bg-edge/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
      >
        <Bell className="size-4" strokeWidth={2.25} aria-hidden="true" />
        {badge > 0 ? (
          <span className="absolute end-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 font-mono text-[9px] font-black leading-none text-white ring-2 ring-space tabular-nums">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            id={panelId}
            role="dialog"
            aria-label="ما يحتاج انتباهك"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: reduce ? 0 : 0.16 }}
            className="fixed inset-x-3 top-[4.25rem] z-40 overflow-hidden rounded-2xl border border-edge/10 bg-space-2 shadow-2xl shadow-black/40 sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-2 sm:w-[23rem]"
          >
            <div className="flex items-center justify-between border-b border-edge/10 px-4 py-3">
              <p className="text-[13px] font-black text-ink">ما يحتاج انتباهك</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
                className="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-edge/5 hover:text-ink sm:hidden"
              >
                <X className="size-4" strokeWidth={2.25} aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[min(70dvh,32rem)] overflow-y-auto overscroll-contain">
              {!ready ? (
                <div className="space-y-2 p-3" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl bg-edge/[0.04]" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
                  <span className="grid size-11 place-items-center rounded-full bg-ok/12 text-ok">
                    <CheckCircle2 className="size-5" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <p className="text-[12.5px] font-black text-ink">لا شيء ينتظرك الآن</p>
                  <p className="text-[11.5px] leading-6 text-ink-3">
                    لا طلبات بانتظار التأكيد، ولا إيصالات أو تقييمات للمراجعة، والمخزون بخير.
                  </p>
                </div>
              ) : (
                <ul className="space-y-1 p-2">
                  {items.map((it) => (
                    <li key={it.key}>
                      <Link
                        href={it.href}
                        onClick={() => setOpen(false)}
                        className="group flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-edge/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
                      >
                        <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl", TONE[it.tone])}>
                          <it.icon className="size-4" strokeWidth={2.1} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-[12.5px] font-black text-ink">{it.title}</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-black", TONE[it.tone])}>{it.chip}</span>
                          </span>
                          <span className="mt-1 block text-[11.5px] leading-5 text-ink-3">{it.desc}</span>
                        </span>
                        <ChevronLeft className="mt-2.5 size-4 shrink-0 text-ink-3 transition group-hover:-translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {arrivals.length > 0 ? (
                <section aria-label="طلبات وصلت أثناء فتح اللوحة" className="border-t border-edge/10 p-2">
                  <div className="flex items-center justify-between px-2.5 pb-1 pt-2">
                    <p className="text-[11px] font-black text-ink-3">وصل أثناء فتح اللوحة</p>
                    <button
                      type="button"
                      onClick={clearArrivals}
                      className="rounded-md px-1.5 py-1 text-[11px] font-bold text-ink-3 transition-colors hover:bg-edge/5 hover:text-ink"
                    >
                      مسح السجل
                    </button>
                  </div>
                  <ul>
                    {arrivals.map((o) => (
                      <li key={o.id}>
                        <Link
                          href={`/dashboard/orders/${o.id}`}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-edge/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-bold text-ink">{o.customerName}</span>
                            <span className="block truncate text-[11px] text-ink-3">
                              {governorateName(o.governorate)} · <span dir="ltr">{o.code}</span> · {timeAgo(o.createdAt)}
                            </span>
                          </span>
                          <span className="shrink-0 text-[12px] font-black tabular-nums text-ink">{formatEgp(o.totalPiasters)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
