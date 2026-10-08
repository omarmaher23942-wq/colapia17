"use client";

// إلغاء تفعيل قُبل فورياً: يعيد المتجر للتجميد ويُبلغ التاجر بالسبب.
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Undo2 } from "lucide-react";
import { revokePaymentAction } from "@/server/actions/platform-payments";

const REASONS = ["التحويل لم يصل إلى حساب المنصة", "المبلغ المحوّل أقل من سعر التفعيل", "الإيصال لا يخص هذا المتجر"];

export function RevokePayment({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(REASONS[0]!);
  const [pending, start] = useTransition();

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 px-3 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/10"
      >
        <Undo2 className="size-3.5" /> إلغاء التفعيل
      </button>
    );

  return (
    <div className="w-full space-y-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3">
      <select
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full rounded-xl border border-rose-500/30 bg-[#07091a] p-2.5 text-xs font-bold text-white outline-none"
      >
        {REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              try {
                await revokePaymentAction(id, note);
                toast.success("أُلغي التفعيل وأُبلغ التاجر");
                setOpen(false);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "تعذّر الإلغاء");
              }
            })
          }
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />} تأكيد الإلغاء
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-3 text-xs font-bold text-slate-300 hover:bg-white/5">
          تراجع
        </button>
      </div>
    </div>
  );
}
