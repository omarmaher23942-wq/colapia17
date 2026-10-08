"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Columns3,
  X,
  Loader2,
  Copy,
  Check,
  TrendingUp,
  Palette,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { compareStoresAction } from "@/server/actions/platform-stores-governance";
import { formatEgp } from "@/lib/money";

const SW = 1.75;

export function StoreComparisonMatrix({
  selectedIds,
  onClear,
}: {
  selectedIds: string[];
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const handleOpen = () => {
    if (selectedIds.length < 2 || selectedIds.length > 4) {
      toast.error("يرجى تحديد من 2 إلى 4 متاجر للمقارنة");
      return;
    }
    setOpen(true);
    start(async () => {
      const res = await compareStoresAction(selectedIds);
      if (res.ok && res.data) setData(res.data);
      else toast.error(res.error);
    });
  };

  const copySummary = () => {
    const text = data
      .map(
        (d) =>
          `${d.name}: ${formatEgp(d.gmv)} GMV, ${d.ordersCount} Orders`
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("تم نسخ الملخص");
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-l from-[#6f86ff] to-[#8fa8ff] px-4 py-2 text-xs font-black text-[#07091a] shadow-md hover:brightness-110 transition-all"
      >
        <Columns3 className="size-4" strokeWidth={SW} />
        مقارنة المتاجر المحددة ({selectedIds.length})
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
            dir="rtl"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b0f2a] shadow-2xl"
            >
              <header className="flex items-center justify-between border-b border-white/10 p-5 bg-[#07091a]">
                <div className="flex items-center gap-2">
                  <Columns3
                    className="size-5 text-[#8fa8ff]"
                    strokeWidth={SW}
                  />
                  <h2 className="text-lg font-black text-white">
                    مصفوفة المقارنة التحليلية
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copySummary}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-[#c3cdf0] hover:bg-white/5"
                  >
                    {copied ? (
                      <Check className="size-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}{" "}
                    نسخ الملخص
                  </button>
                  <button
                    onClick={() => {
                      setOpen(false);
                      onClear();
                    }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                  >
                    <X className="size-5" strokeWidth={SW} />
                  </button>
                </div>
              </header>

              <div className="flex-1 overflow-auto p-5">
                {pending ? (
                  <div className="grid h-full place-items-center">
                    <Loader2 className="size-8 animate-spin text-[#8fa8ff]" />
                  </div>
                ) : (
                  <table className="w-full text-sm text-start border-collapse">
                    <thead>
                      <tr>
                        <th className="p-4 border-b border-white/10 text-slate-400 w-48">
                          المعيار
                        </th>
                        {data.map((d) => (
                          <th
                            key={d.id}
                            className="p-4 border-b border-white/10 text-white font-black text-base bg-white/[0.02] rounded-t-xl"
                          >
                            {d.name}
                            <span className="block text-[10px] font-mono text-slate-500 mt-1 font-normal">
                              {d.subdomain}.colapia.com
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      <tr className="bg-white/[0.01]">
                        <td className="p-4 font-bold text-[#8fa8ff] flex items-center gap-2">
                          <TrendingUp className="size-4" /> الأداء التجاري
                        </td>
                        {data.map((d) => (
                          <td key={d.id} className="p-4"></td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 text-slate-400 text-xs">
                          إجمالي المبيعات (GMV)
                        </td>
                        {data.map((d) => (
                          <td
                            key={d.id}
                            className="p-4 font-mono font-black text-emerald-400"
                          >
                            {formatEgp(d.gmv)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 text-slate-400 text-xs">
                          عدد الطلبات
                        </td>
                        {data.map((d) => (
                          <td
                            key={d.id}
                            className="p-4 font-mono font-bold text-white"
                          >
                            {d.ordersCount}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 text-slate-400 text-xs">
                          متوسط قيمة الطلب (AOV)
                        </td>
                        {data.map((d) => (
                          <td
                            key={d.id}
                            className="p-4 font-mono text-slate-300"
                          >
                            {formatEgp(d.aov)}
                          </td>
                        ))}
                      </tr>

                      <tr className="bg-white/[0.01]">
                        <td className="p-4 font-bold text-[#8fa8ff] flex items-center gap-2">
                          <Palette className="size-4" /> الهوية والـ Blueprint
                        </td>
                        {data.map((d) => (
                          <td key={d.id} className="p-4"></td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 text-slate-400 text-xs">
                          اللون الأساسي
                        </td>
                        {data.map((d) => (
                          <td key={d.id} className="p-4">
                            <div className="flex items-center gap-2">
                              <span
                                className="size-4 rounded-full border border-white/20"
                                style={{ backgroundColor: d.primaryColor }}
                              />
                              <span className="font-mono text-xs">
                                {d.primaryColor}
                              </span>
                            </div>
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 text-slate-400 text-xs">
                          الخط المستخدم
                        </td>
                        {data.map((d) => (
                          <td key={d.id} className="p-4 text-white text-xs">
                            {d.font}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 text-slate-400 text-xs">
                          عدد أقسام الرئيسية
                        </td>
                        {data.map((d) => (
                          <td
                            key={d.id}
                            className="p-4 font-mono text-white"
                          >
                            {d.sectionsCount}
                          </td>
                        ))}
                      </tr>

                      <tr className="bg-white/[0.01]">
                        <td className="p-4 font-bold text-[#8fa8ff] flex items-center gap-2">
                          <CreditCard className="size-4" /> بوابات الدفع
                        </td>
                        {data.map((d) => (
                          <td key={d.id} className="p-4"></td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 text-slate-400 text-xs">
                          الدفع عند الاستلام
                        </td>
                        {data.map((d) => (
                          <td key={d.id} className="p-4">
                            {d.codEnabled ? "✅ مفعّل" : "❌ معطّل"}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 text-slate-400 text-xs">
                          فودافون كاش
                        </td>
                        {data.map((d) => (
                          <td key={d.id} className="p-4">
                            {d.vCashEnabled ? "✅ مفعّل" : "❌ معطّل"}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 text-slate-400 text-xs">
                          إنستاباي
                        </td>
                        {data.map((d) => (
                          <td key={d.id} className="p-4">
                            {d.instapayEnabled ? "✅ مفعّل" : "❌ معطّل"}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}