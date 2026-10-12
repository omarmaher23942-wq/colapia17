"use client";

// AbandonedCarts — سلات متروكة خلال 7 أيام لعملاء كتبوا رقمهم ولم يكملوا الطلب: رسالة واتساب جاهزة (قالب المتجر
// في رسائل الطلبات) ومعها رابط «أكمل طلبك» يعيد منتجاته للسلة ويفتح الدفع، وكود خصم اختياري من أكواد المتجر الفعّالة.
// فتح الرسالة يسجّل «تواصلت» فتخرج السلة من «ما يحتاج انتباهك» (ويمكن التراجع).
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { Check, MessageCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { waLink } from "@/lib/whatsapp";
import { markCartContactedAction } from "@/server/actions/carts";
import { requestPulse } from "../DashboardPulse";

export type CartRow = {
  id: string;
  name: string | null;
  phone: string;
  subtotal: number;
  firstItem: string | null;
  itemsCount: number;
  lastSeenAt: string;
  contacted: boolean;
  /** رابط «أكمل طلبك» الموقّع. */
  restoreUrl: string;
};

export type PromoOption = { code: string; label: string };

function ago(iso: string): string {
  const h = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3600e3));
  if (h < 1) return "منذ أقل من ساعة";
  if (h < 24) return h === 1 ? "منذ ساعة" : h === 2 ? "منذ ساعتين" : `منذ ${h} ${h <= 10 ? "ساعات" : "ساعة"}`;
  const d = Math.round(h / 24);
  return d === 1 ? "منذ يوم" : d === 2 ? "منذ يومين" : `منذ ${d} أيام`;
}

/** قالب المتجر ({name} و{items}) + رابط الاسترجاع، وسطر الخصم إن اختاره التاجر. */
export function recoveryMessage(template: string | null, storeName: string, c: Pick<CartRow, "name" | "firstItem" | "itemsCount" | "restoreUrl">, promo: PromoOption | null): string {
  const what = c.firstItem ? `«${c.firstItem}»${c.itemsCount > 1 ? " ومنتجات أخرى" : ""}` : "منتجاتك";
  const base = template?.trim()
    ? template.replaceAll("{name}", c.name ?? "").replaceAll("{items}", what).replace(/\s+،/g, "،").replace(/\s{2,}/g, " ").trim()
    : `${c.name ? `أهلاً ${c.name}` : "أهلاً بك"}، معك ${storeName}. لاحظنا أن طلبك لـ${what} لم يكتمل.`;
  const url = promo ? `${c.restoreUrl}&promo=${encodeURIComponent(promo.code)}` : c.restoreUrl;
  const deal = promo ? ` وخصّصنا لك ${promo.label} بالكود ${promo.code}، يُطبَّق تلقائياً.` : "";
  return `${base}${deal} سلتك محفوظة، أكمل طلبك من هنا: ${url}`;
}

const PROMO_KEY = "clp_cart_promo";

export function AbandonedCarts({ storeName, rows, template, promos }: { storeName: string; rows: CartRow[]; template: string | null; promos: PromoOption[] }) {
  const [pending, start] = useTransition();
  const [promoCode, setPromoCode] = useState("");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROMO_KEY) ?? "";
      if (promos.some((p) => p.code === saved)) setPromoCode(saved);
    } catch {
      /* التخزين غير متاح */
    }
  }, [promos]);
  const promo = promos.find((p) => p.code === promoCode) ?? null;
  const pickPromo = (code: string) => {
    setPromoCode(code);
    try {
      localStorage.setItem(PROMO_KEY, code);
    } catch {
      /* التخزين غير متاح */
    }
  };
  const [list, setOptimistic] = useOptimistic(rows, (cur, upd: { id: string; contacted: boolean }) =>
    cur.map((r) => (r.id === upd.id ? { ...r, contacted: upd.contacted } : r))
  );

  const mark = (id: string, contacted: boolean) =>
    start(async () => {
      setOptimistic({ id, contacted });
      const res = await markCartContactedAction({ cartId: id, contacted });
      if (!res.ok) toast.error(res.error);
      requestPulse();
    });

  if (list.length === 0) return null;
  const open = list.filter((r) => !r.contacted).length;

  return (
    <section id="abandoned" aria-labelledby="abandoned-title" className="dash-card scroll-mt-24 p-4 sm:p-5">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="abandoned-title" className="text-[14px] font-black text-ink">
          سلات متروكة يمكن استرجاعها
        </h2>
        <p className="text-[11.5px] text-ink-3">
          {open > 0 ? "عملاء كتبوا رقمهم ولم يكملوا الطلب خلال 7 أيام" : "تواصلت مع كل أصحاب السلات"}
        </p>
      </header>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
        <label htmlFor="cart-promo">مع الرسالة:</label>
        <select
          id="cart-promo"
          value={promoCode}
          onChange={(e) => pickPromo(e.target.value)}
          className="min-h-9 rounded-lg border border-edge/10 bg-edge/[0.03] px-2 text-[12px] text-ink outline-none focus:border-nova"
        >
          <option value="">رابط الاسترجاع فقط</option>
          {promos.map((p) => (
            <option key={p.code} value={p.code}>
              {p.code} ({p.label})
            </option>
          ))}
        </select>
        {promos.length === 0 ? (
          <a href="/dashboard/discounts" className="font-bold text-nova-2 hover:text-ink">
            أنشئ كود خصم للاسترجاع
          </a>
        ) : null}
      </div>

      <ul className="divide-y divide-edge/[0.06]">
        {list.map((c) => {
          const href = waLink(c.phone, recoveryMessage(template, storeName, c, promo));
          return (
            <li key={c.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 py-3", c.contacted && "opacity-60")}>
              <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                <p className="truncate text-[13px] font-bold text-ink">
                  {c.name ?? "عميل بلا اسم"}
                  <span className="ms-2 text-[11px] font-normal text-ink-3">{ago(c.lastSeenAt)}</span>
                </p>
                <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-ink-3">
                  <span className="truncate">{c.firstItem ?? "سلة"}</span>
                  {c.itemsCount > 1 ? (
                    <span className="shrink-0 rounded-full bg-edge/[0.06] px-1.5 text-[10.5px] font-bold" title={`${c.itemsCount} منتجات في السلة`}>
                      +{c.itemsCount - 1}
                    </span>
                  ) : null}
                  <span aria-hidden="true">·</span>
                  <span dir="ltr" className="shrink-0">
                    {c.phone}
                  </span>
                </p>
              </div>
              <span className="me-auto shrink-0 text-[13px] font-black tabular-nums text-ink sm:me-0">{formatEgp(c.subtotal)}</span>
              {c.contacted ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => mark(c.id, false)}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-edge/10 px-3 text-[12px] font-bold text-ink-3 transition-colors hover:bg-edge/5 hover:text-ink"
                >
                  <Check className="size-3.5 text-ok" strokeWidth={2.5} aria-hidden="true" />
                  تواصلت
                  <RotateCcw className="size-3" aria-label="تراجع" />
                </button>
              ) : href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => mark(c.id, true)}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-ok/12 px-3.5 text-[12px] font-black text-ok transition-colors hover:bg-ok/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ok"
                >
                  <MessageCircle className="size-4" strokeWidth={2.25} aria-hidden="true" />
                  راسله على واتساب
                </a>
              ) : (
                <span className="text-[11.5px] text-ink-3">رقم غير صالح لواتساب</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
