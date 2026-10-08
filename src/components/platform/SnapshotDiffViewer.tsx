"use client";

import { useState, useTransition } from "react";
import {
  GitCompare,
  RotateCcw,
  X,
  Loader2,
  Layers,
  Palette,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { rollbackSnapshotAction } from "@/server/actions/platform-stores-governance";
import type { StoreBlueprint } from "@/blueprint/schema";
import { cn } from "@/lib/utils";

const SW = 1.75;

type Snapshot = {
  id: string;
  version: number;
  label: string | null;
  createdAt: Date;
  createdBy: string;
  data: StoreBlueprint;
};

export function SnapshotDiffViewer({
  storeId,
  currentBp,
  snapshots,
}: {
  storeId: string;
  currentBp: StoreBlueprint;
  snapshots: Snapshot[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const targetSnap = snapshots.find((s) => s.id === selectedId);

  const handleRollback = () => {
    if (!selectedId) return;
    if (
      !confirm(
        "هل أنت متأكد من استرجاع هذه النسخة؟ سيتم حفظ النسخة الحالية كاحتياطي."
      )
    )
      return;

    start(async () => {
      const res = await rollbackSnapshotAction(storeId, selectedId);
      if (res.ok) {
        toast.success("تم استرجاع النسخة بنجاح");
        setOpen(false);
      } else {
        toast.error(res.error || "فشل الاسترجاع");
      }
    });
  };

  const DiffRow = ({ label, oldVal, newVal, icon: Icon }: any) => {
    if (oldVal === newVal) return null;
    return (
      <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <Icon className="size-4 text-[#8fa8ff]" strokeWidth={SW} />
          {label}
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className="rounded bg-rose-500/20 px-2 py-1 text-rose-300 line-through">
            {oldVal}
          </span>
          <span className="text-slate-500">←</span>
          <span className="rounded bg-emerald-500/20 px-2 py-1 text-emerald-300">
            {newVal}
          </span>
        </div>
      </div>
    );
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[#8fa8ff]/30 bg-[#6f86ff]/10 px-4 py-2 text-xs font-bold text-[#8fa8ff] hover:bg-[#6f86ff]/20 transition-colors"
      >
        <GitCompare className="size-4" strokeWidth={SW} />
        فاحص النسخ (Deep-Diff)
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            dir="rtl"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b0f2a] shadow-2xl"
            >
              <header className="flex items-center justify-between border-b border-white/10 p-5">
                <div className="flex items-center gap-2">
                  <GitCompare
                    className="size-5 text-[#8fa8ff]"
                    strokeWidth={SW}
                  />
                  <h2 className="text-lg font-black text-white">
                    مقارنة واسترجاع النسخ
                  </h2>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="size-5" strokeWidth={SW} />
                </button>
              </header>

              <div className="flex flex-1 overflow-hidden">
                <div className="w-1/3 border-e border-white/10 bg-[#07091a] overflow-y-auto p-3 space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">
                    سجل الإصدارات
                  </p>
                  {snapshots.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={cn(
                        "w-full text-start p-3 rounded-xl border transition-colors",
                        selectedId === s.id
                          ? "border-[#8fa8ff] bg-[#6f86ff]/15"
                          : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-white">
                          v{s.version}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {new Date(s.createdAt).toLocaleString("ar-EG")}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#8fa8ff] truncate">
                        {s.label || "تحديث"}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-1">
                        بواسطة: {s.createdBy}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="flex-1 p-5 overflow-y-auto bg-[#0b0f2a]">
                  {!targetSnap ? (
                    <div className="grid h-full place-items-center text-slate-500 text-sm">
                      اختر نسخة من القائمة للمقارنة مع النسخة الحالية
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between bg-[#6f86ff]/10 border border-[#8fa8ff]/30 p-4 rounded-2xl">
                        <div>
                          <p className="text-xs font-bold text-[#8fa8ff]">
                            مقارنة النسخة الحالية مع v{targetSnap.version}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {targetSnap.label}
                          </p>
                        </div>
                        <button
                          onClick={handleRollback}
                          disabled={pending}
                          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white hover:bg-rose-700 transition-colors disabled:opacity-50"
                        >
                          {pending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <RotateCcw className="size-4" />
                          )}
                          استرجاع هذه النسخة فوراً
                        </button>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-sm font-black text-white border-b border-white/10 pb-2">
                          الفروقات الأساسية
                        </h3>
                        <DiffRow
                          label="اللون الأساسي"
                          oldVal={currentBp.theme.palette.primary}
                          newVal={targetSnap.data.theme.palette.primary}
                          icon={Palette}
                        />
                        <DiffRow
                          label="لون الخلفية"
                          oldVal={currentBp.theme.palette.background}
                          newVal={targetSnap.data.theme.palette.background}
                          icon={Palette}
                        />
                        <DiffRow
                          label="عدد الأقسام بالرئيسية"
                          oldVal={currentBp.home.length}
                          newVal={targetSnap.data.home.length}
                          icon={Layers}
                        />
                        <DiffRow
                          label="الخط المستخدم"
                          oldVal={currentBp.theme.fonts.heading}
                          newVal={targetSnap.data.theme.fonts.heading}
                          icon={Palette}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}