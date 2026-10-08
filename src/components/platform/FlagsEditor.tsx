"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, Loader2, Check, AlertTriangle, ToggleLeft, ToggleRight, RotateCcw, SlidersHorizontal } from "lucide-react";
import { setFlagAction } from "@/server/actions/platform-flags";
import { cn } from "@/lib/utils";

const SW = 1.75;

type FlagRow = {
  key: string;
  enabled: boolean;
  description: string;
  config: string;
};

function toneOf(key: string): string {
  if (key.startsWith("bot.")) return "border-violet-500/30 bg-violet-500/5";
  if (key.startsWith("build.")) return "border-[#6f86ff]/30 bg-[#6f86ff]/5";
  if (key.startsWith("payments.")) return "border-emerald-500/30 bg-emerald-500/5";
  if (key.startsWith("pricing.")) return "border-amber-500/30 bg-amber-500/5";
  return "border-white/10 bg-white/[0.02]";
}

function validateJson(text: string): { ok: boolean; error?: string } {
  if (!text.trim()) return { ok: true };
  try {
    JSON.parse(text);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 120) : "JSON غير صالح" };
  }
}

export function FlagsEditor({ rows }: { rows: FlagRow[] }) {
  const [data, setData] = useState(rows);
  const [initial] = useState(rows);
  const [pending, start] = useTransition();
  const [savingAll, setSavingAll] = useState(false);

  const rowStates = useMemo(() => data.map((r) => {
    const init = initial.find((x) => x.key === r.key);
    const dirty = !init || init.enabled !== r.enabled || init.config.trim() !== r.config.trim();
    const json = validateJson(r.config);
    return { dirty, jsonOk: json.ok, jsonError: json.error };
  }), [data, initial]);

  const update = (i: number, patch: Partial<FlagRow>) => setData((curr) => curr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const saveOne = async (i: number) => {
    const row = data[i];
    if (!row) return;
    const json = validateJson(row.config);
    if (!json.ok) return toast.error(`JSON غير صالح: ${json.error}`);
    try {
      await setFlagAction(row.key, row.enabled, row.config);
      toast.success(`تم حفظ ${row.key}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    }
  };

  const saveAll = () => {
    start(() => {
      void (async () => {
        setSavingAll(true);
        const dirtyRows = data.filter((_, i) => rowStates[i]?.dirty);
        if (dirtyRows.length === 0) {
          setSavingAll(false);
          return toast.success("لا توجد تغييرات");
        }
        const invalid = data.filter((r) => !validateJson(r.config).ok).map((r) => r.key);
        if (invalid.length > 0) {
          setSavingAll(false);
          return toast.error(`JSON غير صالح في: ${invalid.join(", ")}`);
        }
        let ok = 0, failed = 0;
        for (const r of dirtyRows) {
          try { await setFlagAction(r.key, r.enabled, r.config); ok++; } catch { failed++; }
        }
        setSavingAll(false);
        if (failed === 0) toast.success(`تم حفظ ${ok} مفتاح بنجاح`);
        else toast.error(`نجح ${ok} · فشل ${failed}`);
      })();
    });
  };

  const dirtyCount = rowStates.filter((s) => s.dirty).length;

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-[#0b0f2a] p-4 shadow-xl">
        <div className="flex items-center gap-3 text-sm font-black text-white">
          <span className="grid size-10 place-items-center rounded-xl bg-[#6f86ff]/20 text-[#8fa8ff]">
            <SlidersHorizontal className="size-5" strokeWidth={SW} />
          </span>
          <div>
            <span>إدارة المزايا ({data.length} مفتاح)</span>
            {dirtyCount > 0 && <p className="text-[10px] text-amber-400 mt-0.5">{dirtyCount} تعديلات غير محفوظة</p>}
          </div>
        </div>
        <button type="button" onClick={saveAll} disabled={pending || dirtyCount === 0} className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-l from-[#6f86ff] to-[#8fa8ff] px-6 text-xs font-black text-[#07091a] shadow-lg hover:brightness-110 disabled:opacity-40 transition-all">
          {savingAll ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          حفظ الكل
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data.map((r, i) => {
          const state = rowStates[i]!;
          const ToggleIcon = r.enabled ? ToggleRight : ToggleLeft;
          return (
            <div key={r.key} className={cn("flex flex-col rounded-3xl border p-5 transition-all shadow-lg", toneOf(r.key), state.dirty && "ring-2 ring-amber-400/40")}>
              <header className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-black text-white">{r.key}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#8d97c4]">{r.description}</p>
                </div>
                <button type="button" onClick={() => update(i, { enabled: !r.enabled })} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors", r.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-slate-400")}>
                  <ToggleIcon className="size-4" strokeWidth={SW} />
                  {r.enabled ? "مفعّل" : "معطّل"}
                </button>
              </header>

              <div className="flex-1">
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">JSON Config (اختياري)</label>
                <textarea dir="ltr" rows={r.config ? 4 : 2} placeholder='{"key": "value"}' value={r.config} onChange={(e) => update(i, { config: e.target.value })} className={cn("w-full rounded-xl border bg-[#07091a] p-3 font-mono text-xs text-[#eaf0ff] outline-none transition-colors", state.jsonOk ? "border-white/10 focus:border-[#6f86ff]/60" : "border-rose-500/50 focus:border-rose-500")} />
                {!state.jsonOk && <p className="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-rose-400"><AlertTriangle className="size-3" /> {state.jsonError}</p>}
              </div>

              <footer className="flex items-center justify-between gap-2 border-t border-white/10 pt-4 mt-4">
                {state.dirty ? <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1"><AlertTriangle className="size-3" /> غير محفوظ</span> : <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1"><Check className="size-3" /> محفوظ</span>}
                <div className="flex items-center gap-2">
                  {state.dirty && <button type="button" onClick={() => { const init = initial.find((x) => x.key === r.key); if (init) update(i, init); }} disabled={pending} className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:bg-white/10 hover:text-white transition-colors"><RotateCcw className="size-3.5" /> استرجاع</button>}
                  <button type="button" onClick={() => saveOne(i)} disabled={pending || !state.dirty || !state.jsonOk} className="rounded-lg bg-white/10 px-4 py-1.5 text-[11px] font-bold text-white hover:bg-white/20 disabled:opacity-40 transition-colors flex items-center gap-1.5"><Save className="size-3.5" /> حفظ</button>
                </div>
              </footer>
            </div>
          );
        })}
      </div>
    </div>
  );
}