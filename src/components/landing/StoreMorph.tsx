"use client";

// StoreMorph — هاتف في واجهة الصفحة يتبدل فيه متجر كامل كل بضع ثوانٍ: نفس الفكرة، هوية مختلفة تماماً.
// يتوقف عند المرور عليه، ويمكن اختيار أي متجر بالنقر. لمن يفضّل حركة أقل: يبقى على متجر واحد.
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { MINI_STORES, StoreMini } from "./StoreMini";

const EVERY_MS = 3800;

export function StoreMorph() {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);

  useEffect(() => {
    if (hold || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % MINI_STORES.length), EVERY_MS);
    return () => window.clearInterval(t);
  }, [hold]);

  const s = MINI_STORES[i]!;
  return (
    <div className="relative mx-auto w-full max-w-[400px]" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
      <div aria-hidden="true" className="absolute -inset-10 -z-10 rounded-full opacity-60 blur-3xl transition-colors duration-1000" style={{ background: `radial-gradient(closest-side, ${s.primary}55, transparent)` }} />

      <div className="land-float relative mx-auto aspect-[9/17] w-[78%] rounded-[2.4rem] border border-white/15 bg-[#05060f] p-2.5 shadow-[0_50px_120px_-30px_rgba(0,0,0,0.9)]">
        <div className="absolute start-1/2 top-3.5 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-black rtl:translate-x-1/2" />
        <div className="relative h-full overflow-hidden rounded-[1.9rem]">
          {MINI_STORES.map((m, k) => (
            <div key={m.name} aria-hidden={k !== i} className={cn("absolute inset-0 pt-7 transition-all duration-700 ease-out", k === i ? "scale-100 opacity-100" : "pointer-events-none scale-[1.04] opacity-0")} style={{ background: m.bg }}>
              {k === i ? <StoreMini s={m} /> : null}
            </div>
          ))}
        </div>
      </div>

      {/* بطاقة الفكرة التصميمية: ما قرره المدير الفني لهذا المتجر */}
      <div key={s.name} className="land-pop absolute -start-2 bottom-16 rounded-2xl border border-white/10 bg-[#0d1230]/90 px-3.5 py-2.5 text-start shadow-2xl backdrop-blur-md sm:-start-8">
        <p className="text-[10px] font-bold text-[#8d97c4]">فكرة التصميم</p>
        <p className="text-[13px] font-black text-white">«{s.concept}»</p>
        <span className="mt-1.5 flex gap-1">
          {[s.primary, s.accent, s.bg, s.fg].map((c) => (
            <span key={c} className="size-3.5 rounded-full ring-1 ring-white/20" style={{ background: c }} />
          ))}
        </span>
      </div>
      <div key={`${s.name}-t`} className="land-pop absolute -end-1 top-20 rounded-2xl border border-white/10 bg-[#0d1230]/90 px-3 py-2 text-[11px] font-bold text-[#c9d4ff] shadow-2xl backdrop-blur-md sm:-end-6" style={{ animationDelay: "120ms" }}>
        ✦ نصوص كتبها الذكاء الاصطناعي لهذا المتجر
      </div>

      <div className="mt-6 flex justify-center gap-2" role="tablist" aria-label="أمثلة متاجر">
        {MINI_STORES.map((m, k) => (
          <button
            key={m.name}
            type="button"
            role="tab"
            aria-selected={k === i}
            aria-label={m.name}
            onClick={() => setI(k)}
            className={cn("h-2 rounded-full transition-all", k === i ? "w-7 bg-[#8fa8ff]" : "w-2 bg-white/25 hover:bg-white/40")}
          />
        ))}
      </div>
    </div>
  );
}
