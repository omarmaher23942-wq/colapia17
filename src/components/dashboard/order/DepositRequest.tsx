"use client";
// DepositRequest — «اطلب عربون» لطلب مخاطِر بالدفع عند الاستلام (درع الدفع عند الاستلام): مبلغ مقترح قابل للتعديل،
// ورسالة واتساب جاهزة للعميل بوسائل تحويل المتجر الحقيقية والباقي عند الاستلام. القرار للتاجر.
import { useMemo, useState } from "react";
import { HandCoins } from "lucide-react";
import { waLink } from "@/lib/whatsapp";
import { depositMessage } from "@/lib/order-messages";
import { formatEgp } from "@/lib/money";
import { inputCls } from "../product/parts";
import { cn } from "@/lib/utils";

export function DepositRequest({
  order,
  storeName,
  suggestedPiasters,
  pay,
}: {
  order: { customerName: string; customerPhone: string; code: string; totalPiasters: number };
  storeName: string;
  suggestedPiasters: number;
  pay: { vodafone?: string | null; instapay?: string | null };
}) {
  const [egp, setEgp] = useState(String(Math.round(suggestedPiasters / 100)));
  const amount = Math.min(order.totalPiasters, Math.max(0, Math.round(Number(egp.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))) || 0) * 100));
  const href = useMemo(() => (amount > 0 ? waLink(order.customerPhone, depositMessage(order, storeName, amount, pay)) : null), [amount, order, storeName, pay]);
  const noWays = !pay.vodafone && !pay.instapay;
  return (
    <div className="mt-3 rounded-xl border border-edge/10 bg-edge/[0.03] p-3">
      <p className="flex items-center gap-1.5 text-[12.5px] font-black text-ink">
        <HandCoins className="size-4 text-nova-2" aria-hidden="true" /> اطلب عربون قبل الشحن
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[12px] text-ink-3">
          المبلغ
          <input value={egp} onChange={(e) => setEgp(e.target.value.replace(/[^\d٠-٩]/g, "").slice(0, 6))} inputMode="numeric" className={cn(inputCls, "h-9 w-24 text-center")} aria-label="مبلغ العربون بالجنيه" />
          ج.م
        </label>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center rounded-lg bg-[#25D366] px-3 text-[12.5px] font-bold text-white">
            ابعت طلب العربون
          </a>
        ) : null}
      </div>
      <p className="mt-1.5 text-[11.5px] leading-5 text-ink-3">
        {noWays
          ? "فعّل فودافون كاش أو إنستاباي من الإعدادات ← الدفع حتى تظهر أرقامك في الرسالة."
          : `الباقي عند الاستلام ${formatEgp(Math.max(0, order.totalPiasters - amount))}. بعد وصول العربون أكّد الطلب واكتبه في ملاحظات الشحن.`}
      </p>
    </div>
  );
}
