"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { decidePaymentAction } from "@/server/actions/platform-payments";
import { cn } from "@/lib/utils";

const SW = 1.75;

const REASONS = [
  "المبلغ غير مطابق لسعر الباقة أو التجديد المعلن",
  "الرقم المُحوَّل إليه غير صحيح (ليس رقم المنصة الرسمي)",
  "صورة الإيصال غير واضحة أو ناقصة التاريخ والرقم",
  "نفس صورة الإيصال استُخدمت في تحويل سابق",
  "لا يوجد رقم مرجعي للعملية للتأكد من وصولها",
];

export function PaymentDecision({ id, suggested }: { id: string; suggested?: string }) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState(REASONS[0]!);

  const decide = (decision: "confirm" | "reject", reasonNote?: string) =>
    start(async () => {
      try {
        await decidePaymentAction(id, decision, reasonNote);
        if (decision === "confirm") {
          toast.success("تم تأكيد الدفع وتفعيل المتجر 🎉");
        } else {
          toast.success("تم رفض الدفعة وإبلاغ التاجر بالسبب.");
        }
        setRejecting(false);
      } catch (e: any) {
        toast.error(e?.message || "حدث خطأ في معالجة الدفعة");
      }
    });

  if (rejecting) {
    return (
      <div className="space-y-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
        <p className="text-xs font-bold text-rose-200 flex items-center gap-1.5">
          <AlertTriangle className="size-4" strokeWidth={SW} />
          اختر سبب الرفض لإبلاغ التاجر:
        </p>
        <select
          className="w-full rounded-xl border border-rose-500/30 bg-[#07091a] p-3 text-xs font-bold text-white outline-none focus:border-rose-400"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        >
          {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => decide("reject", note)}
            className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
            تأكيد الرفض وإرسال السبب
          </button>
          <button
            type="button"
            onClick={() => setRejecting(false)}
            className="rounded-xl border border-white/20 px-4 text-xs font-bold text-slate-300 hover:bg-white/10 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => decide("confirm")}
        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-emerald-400 to-emerald-500 py-3 text-xs font-black text-[#07091a] shadow-lg hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
      >
        {pending ? <Loader2 className="size-4.5 animate-spin" /> : <CheckCircle2 className="size-4.5" />}
        <span>تأكيد التحويل وتفعيل المتجر</span>
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => setRejecting(true)}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-5 py-3 text-xs font-bold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 transition-colors"
      >
        <XCircle className="size-4" strokeWidth={SW} />
        <span>رفض</span>
      </button>
    </div>
  );
}