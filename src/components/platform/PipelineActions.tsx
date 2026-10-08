"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Pencil, Rocket, Timer, Lock, RefreshCw, MessageSquare
} from "lucide-react";
import {
  deliverNowAction,
  extendAction,
  retryBuildAction,
  freezeNowAction,
} from "@/server/actions/platform-ops";

const SW = 1.75;

export function Countdown({ to }: { to: string }) {
  const [t, setT] = useState("");

  useEffect(() => {
    const f = () => {
      const ms = new Date(to).getTime() - Date.now();
      if (ms <= 0) return setT("الآن");
      const h = Math.floor(ms / 36e5),
        m = Math.floor(ms / 6e4) % 60,
        s = Math.floor(ms / 1e3) % 60;
      setT(
        h > 48
          ? `${Math.floor(h / 24)} يوم`
          : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    };
    f();
    const iv = setInterval(f, 1000);
    return () => clearInterval(iv);
  }, [to]);

  return <b className="tabular-nums text-white font-bold">{t}</b>;
}

export function PipelineActions({
  storeId,
  status,
  jobFailed,
}: {
  storeId: string;
  status: string;
  jobFailed?: boolean;
}) {
  const [p, start] = useTransition();

  const go = (fn: () => Promise<unknown>, okMsg: string) =>
    start(async () => {
      try {
        await fn();
        toast.success(okMsg);
      } catch (e: any) {
        toast.error(e?.message || "حدث خطأ");
      }
    });

  const B = "inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all active:scale-95 disabled:opacity-40";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-2.5">
      {/* زر التعديل بالمحرر والـ AI */}
      <Link
        href={`/admin/stores/${storeId}/edit`}
        className={`${B} border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white`}
      >
        <Pencil className="size-3" strokeWidth={SW} />
        تعديل + AI
      </Link>

      {/* إجراءات مرحلة المراجعة (10 دقائق) */}
      {status === "review" && (
        <>
          <button
            type="button"
            disabled={p}
            onClick={() => go(() => deliverNowAction(storeId), "تم تسليم المتجر للعميل وإرسال الروابط فوراً 🚀")}
            className={`${B} bg-gradient-to-l from-teal-400 to-teal-500 text-black font-black shadow-md hover:brightness-105`}
          >
            <Rocket className="size-3" strokeWidth={SW} />
            سلّم الآن
          </button>
          <button
            type="button"
            disabled={p}
            onClick={() => go(() => extendAction(storeId, "deliver", 1), "تم مدّ المراجعة ساعة إضافية")}
            className={`${B} border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10`}
          >
            <Timer className="size-3" strokeWidth={SW} />
            +ساعة
          </button>
        </>
      )}

      {/* إجراءات مرحلة التجربة (24 ساعة) */}
      {status === "trial" && (
        <>
          <button
            type="button"
            disabled={p}
            onClick={() => go(() => extendAction(storeId, "trial", 24), "تم مد التجربة 24 ساعة إضافية")}
            className={`${B} border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10`}
          >
            <Timer className="size-3" strokeWidth={SW} />
            +24س
          </button>
          <button
            type="button"
            disabled={p}
            onClick={() => confirm("تجميد المتجر الآن؟") && go(() => freezeNowAction(storeId), "تم تجميد المتجر")}
            className={`${B} border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20`}
          >
            <Lock className="size-3" strokeWidth={SW} />
            تجميد
          </button>
        </>
      )}

      {/* إعادة البناء في حال الفشل */}
      {(jobFailed || status === "building") && (
        <button
          type="button"
          disabled={p}
          onClick={() => go(() => retryBuildAction(storeId), "أُعيد تشغيل بناء المتجر بالـ AI")}
          className={`${B} bg-violet-600 text-white font-bold hover:bg-violet-700`}
        >
          <RefreshCw className="size-3" strokeWidth={SW} />
          إعادة البناء
        </button>
      )}
    </div>
  );
}