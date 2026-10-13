"use client";

// StockAlertsPanel — في صفحة المنتج باللوحة: من طلب التنبيه عند توفر المنتج (أو مقاس بعينه). لكل شخص زر يفتح واتساب برسالة
// «رجع تاني» جاهزة فيها رابط المنتج، ثم يُعلَّم «تم الإبلاغ». الإرسال بيد التاجر عمداً (لا رسائل آلية لزبائنه).
import { useState, useTransition } from "react";
import { BellRing, Check, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { waLink } from "@/lib/whatsapp";
import { restockMessage } from "@/lib/order-messages";
import { deleteStockAlertAction, markStockAlertsAction } from "@/server/actions/stock-alerts";
import { BrandIcon } from "@/components/storefront/brand-icons";
import { cn } from "@/lib/utils";

type Alert = { id: string; phone: string; name: string | null; variantLabel: string | null; notifiedAt: string | null; createdAt: string };

export function StockAlertsPanel({ alerts: initial, product, storeName }: { alerts: Alert[]; product: { name: string; url: string }; storeName: string }) {
  const [alerts, setAlerts] = useState(initial);
  const [, start] = useTransition();
  const waiting = alerts.filter((a) => !a.notifiedAt);

  const mark = (ids: string[], notified: boolean) =>
    start(async () => {
      const r = await markStockAlertsAction(ids, notified);
      if (!r.ok) return void toast.error(r.error);
      setAlerts((all) => all.map((a) => (ids.includes(a.id) ? { ...a, notifiedAt: notified ? new Date().toISOString() : null } : a)));
    });

  return (
    <section className="dash-card mx-auto mt-6 max-w-6xl space-y-3 p-4 sm:p-5" aria-label="ينتظرون التوفر">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-black text-ink">
          <BellRing className="size-4 text-nova" aria-hidden="true" /> ينتظرون التوفر
          <span className="rounded-full bg-nova/15 px-2 py-0.5 text-[11px] text-ink">{waiting.length}</span>
        </h2>
        {waiting.length > 1 ? (
          <button type="button" onClick={() => mark(waiting.map((a) => a.id), true)} className="text-[12px] font-bold text-ink-3 hover:text-ink">
            الكل «تم الإبلاغ»
          </button>
        ) : null}
      </div>
      <p className="text-[12.5px] text-ink-3">لما المنتج يرجع: رسالة واتساب الجاهزة لكل شخص، ثم «تم الإبلاغ». الأولوية للأقدم.</p>
      <ul className="divide-y divide-edge/10">
        {alerts.map((a) => {
          const href = waLink(a.phone, restockMessage(a, product, storeName));
          return (
            <li key={a.id} className={cn("flex flex-wrap items-center gap-3 py-2.5", a.notifiedAt && "opacity-60")}>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-ink" dir="ltr">{a.phone}{a.name ? <span dir="rtl"> · {a.name}</span> : null}</p>
                <p className="text-[11.5px] text-ink-3">
                  {a.variantLabel ?? "المنتج كله"} · {new Date(a.createdAt).toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "short" })}
                  {a.notifiedAt ? " · تم الإبلاغ" : ""}
                </p>
              </div>
              {href && !a.notifiedAt ? (
                <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => setTimeout(() => mark([a.id], true), 400)} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#25D366] px-3 text-[12px] font-black text-white">
                  <BrandIcon brand="whatsapp" className="size-4" /> «رجع تاني»
                </a>
              ) : null}
              {a.notifiedAt ? (
                <button type="button" onClick={() => mark([a.id], false)} className="grid size-9 place-items-center rounded-xl text-ink-3 hover:text-ink" aria-label="إلغاء «تم الإبلاغ»">
                  <Undo2 className="size-4" aria-hidden="true" />
                </button>
              ) : (
                <button type="button" onClick={() => mark([a.id], true)} className="grid size-9 place-items-center rounded-xl text-ink-3 hover:text-ink" aria-label="تم الإبلاغ">
                  <Check className="size-4" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  start(async () => {
                    const r = await deleteStockAlertAction(a.id);
                    if (!r.ok) return void toast.error(r.error);
                    setAlerts((all) => all.filter((x) => x.id !== a.id));
                  })
                }
                className="grid size-9 place-items-center rounded-xl text-ink-3 hover:text-rose-400"
                aria-label="حذف"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
