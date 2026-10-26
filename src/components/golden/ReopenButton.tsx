"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { reopenBookingAction } from "@/golden/actions";

/** «أرسلوا إيصالاً جديداً» بعد رفض إيصال: يعيد فتح الحجز ببياناته السابقة. */
export function ReopenButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await reopenBookingAction(token);
            if (!r.ok) return setError(r.error);
            router.push(r.next);
          })
        }
        className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--g-accent)] px-5 text-[15px] font-black text-[var(--g-on-accent)] disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}
        إرسال إيصال جديد
      </button>
      {error ? <p role="alert" className="mt-2 text-[13px] font-bold text-[var(--g-bad)]">{error}</p> : null}
    </div>
  );
}
