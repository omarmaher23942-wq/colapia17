"use client";

// InventoryMode — اختيار التاجر الصريح لطريقة المخزون في متجره كله (setInventoryTrackingAction):
// «نتتبع الكميات» أو «كل المنتجات متاحة دائماً». في صفحة المنتجات شريط مختصر يفتح نافذة الاختيار، وفي الإعدادات
// يظهر الاختيار كاملاً. التبديل يطبَّق على كل المنتجات، والكميات المكتوبة تبقى محفوظة للعودة إليها.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Check, Infinity as InfinityIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { arCount, NOUN } from "@/lib/format";
import { setInventoryTrackingAction } from "@/server/actions/inventory";
import { DashDialog } from "../ui/DashDialog";
import { requestPulse } from "../DashboardPulse";

const OPTIONS = [
  {
    tracking: true,
    title: "نتتبع الكميات",
    text: "لكل منتج (ومقاس ولون) كمية تقل مع كل طلب حقيقي، ويظهر «نفد» عند الصفر. طلباتك التجريبية لا تخصم شيئاً.",
    icon: Boxes,
  },
  {
    tracking: false,
    title: "كل المنتجات متاحة دائماً",
    text: "لا نعدّ الكميات ولا يظهر «نفد» أبداً. مناسب لمن يصنع بالطلب أو عنده بضاعة وفيرة.",
    icon: InfinityIcon,
  },
] as const;

export function InventoryMode({ tracking, compact }: { tracking: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!compact) return <Choice tracking={tracking} />;
  const cur = OPTIONS.find((o) => o.tracking === tracking)!;
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-edge/10 bg-edge/[0.02] px-4 py-3">
        <cur.icon className="size-4 shrink-0 text-nova-2" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-[12.5px] text-ink-2">
          <span className="font-black text-ink">المخزون: {cur.title}.</span> {tracking ? "تقل الكمية مع كل طلب حقيقي." : "لا يظهر «نفد» على أي منتج."}
        </p>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-9 items-center rounded-lg border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/5 hover:text-ink">
          غيّر الطريقة
        </button>
      </div>
      <DashDialog open={open} onClose={() => setOpen(false)} title="المخزون في متجرك" description="يطبَّق على كل المنتجات فوراً، ويمكنك تغييره متى شئت.">
        <Choice tracking={tracking} onDone={() => setOpen(false)} />
      </DashDialog>
    </>
  );
}

function Choice({ tracking: saved, onDone }: { tracking: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<boolean | null>(null);
  // القيمة المحفوظة فوراً بعد النجاح، دون انتظار إعادة تحميل الصفحة من الخادم.
  const [tracking, setTracking] = useState(saved);
  useEffect(() => setTracking(saved), [saved]);

  async function pick(next: boolean) {
    if (next === tracking || busy !== null) return;
    setBusy(next);
    const r = await setInventoryTrackingAction(next).catch(() => ({ ok: false as const, error: "انقطع الاتصال، حاول مرة أخرى" }));
    setBusy(null);
    if (!r.ok) return void toast.error(r.error);
    setTracking(r.tracking);
    toast.success(
      r.tracking
        ? r.withoutQuantity
          ? `صرنا نتتبع الكميات. ${arCount(r.withoutQuantity, NOUN.product)} بلا كمية مكتوبة ${r.withoutQuantity === 1 ? "يبقى متاحاً" : "تبقى متاحة"} حتى تكتبها من صفحة المنتج.`
          : "صرنا نتتبع الكميات في كل المنتجات"
        : "كل المنتجات متاحة دائماً الآن، وكمياتك محفوظة إن عدت للتتبع"
    );
    requestPulse();
    router.refresh();
    onDone?.();
  }

  return (
    <div role="radiogroup" aria-label="طريقة المخزون" className="grid gap-2 sm:grid-cols-2">
      {OPTIONS.map((o) => {
        const on = o.tracking === tracking;
        return (
          <button
            key={o.title}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={busy !== null}
            onClick={() => void pick(o.tracking)}
            className={cn(
              "flex items-start gap-3 rounded-2xl border p-4 text-start transition-colors disabled:cursor-wait",
              on ? "border-nova/50 bg-nova/10" : "border-edge/10 hover:border-edge/25 hover:bg-edge/[0.03]"
            )}
          >
            <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border", on ? "border-nova bg-nova text-white" : "border-edge/30")} aria-hidden="true">
              {busy === o.tracking ? <Loader2 className="size-3.5 animate-spin" /> : on ? <Check className="size-3.5" /> : null}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[13.5px] font-black text-ink">
                <o.icon className="size-4 text-ink-3" aria-hidden="true" />
                {o.title}
              </span>
              <span className="mt-1 block text-[12px] leading-6 text-ink-2">{o.text}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
