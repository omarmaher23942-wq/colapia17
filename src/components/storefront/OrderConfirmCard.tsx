"use client";

// OrderConfirmCard — أزرار «أكّد طلبي» و«ألغِ الطلب» في صفحة رابط التأكيد. الإلغاء يسأل عن السبب اختيارياً ويطلب تأكيداً.
import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { customerOrderDecisionAction } from "@/server/actions/order-confirm";

const SW = 1.75;

export function OrderConfirmCard({ subdomain, code, token, orderHref }: { subdomain: string; code: string; token: string; orderHref: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<"confirmed" | "cancelled" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  const decide = (decision: "confirm" | "cancel") =>
    start(async () => {
      setError(null);
      const r = await customerOrderDecisionAction({ subdomain, code, token, decision, reason: reason || undefined });
      if (r.ok) setDone(r.status);
      else setError(r.error);
    });

  if (done)
    return (
      <div className="mt-6 rounded-2xl border border-border p-5 text-center">
        {done === "confirmed" ? (
          <CheckCircle2 strokeWidth={SW} className="mx-auto size-10 text-[var(--brand)]" aria-hidden="true" />
        ) : (
          <XCircle strokeWidth={SW} className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
        )}
        <p className="mt-3 text-lg font-bold">{done === "confirmed" ? "تم تأكيد طلبك، شكراً لك" : "تم إلغاء الطلب"}</p>
        <p className="mt-1 text-sm leading-7 text-muted-foreground">
          {done === "confirmed" ? "يبدأ المتجر تجهيزه الآن، وتتابع حالته من صفحة الطلب." : "إن كان الإلغاء بالخطأ تواصل مع المتجر مباشرة."}
        </p>
        <Link href={orderHref} className="btn-brand mt-5">
          صفحة الطلب
        </Link>
      </div>
    );

  return (
    <div className="mt-6 space-y-3">
      {error ? (
        <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm font-bold text-red-600">
          {error}
        </p>
      ) : null}
      {!cancelling ? (
        <>
          <button type="button" disabled={pending} onClick={() => decide("confirm")} className="btn-brand btn-brand-lg w-full">
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <CheckCircle2 strokeWidth={SW} className="size-5" aria-hidden="true" />}
            أكّد طلبي، البيانات صحيحة
          </button>
          <button type="button" disabled={pending} onClick={() => setCancelling(true)} className="w-full rounded-xl py-3 text-sm font-bold text-muted-foreground underline-offset-4 hover:underline">
            لا أريد الطلب، ألغِه
          </button>
        </>
      ) : (
        <div className="rounded-2xl border border-border p-4">
          <label htmlFor="reason" className="text-sm font-bold">
            سبب الإلغاء (اختياري، يساعد المتجر)
          </label>
          <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))} rows={2} className="s-input mt-2 w-full rounded-xl border border-border bg-transparent p-3 text-sm" />
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={pending} onClick={() => decide("cancel")} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white disabled:opacity-50">
              {pending ? "..." : "نعم، ألغِ الطلب"}
            </button>
            <button type="button" disabled={pending} onClick={() => setCancelling(false)} className="flex-1 rounded-xl border border-border py-3 text-sm font-bold">
              تراجع
            </button>
          </div>
        </div>
      )}
      <p className="text-center text-xs leading-6 text-muted-foreground">لتعديل العنوان أو المقاس رد على رسالة المتجر في واتساب قبل التأكيد.</p>
    </div>
  );
}
