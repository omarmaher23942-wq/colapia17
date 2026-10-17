// OrderTimeline — الخط الزمني لحالة الطلب (خادم): الخطوات المنتهية بوقتها، والحالية، والمتبقية.
import { Check } from "lucide-react";
import { buildTimeline } from "@/lib/order-requests";
import { cn } from "@/lib/utils";

const when = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" }).format(new Date(iso)) : null;

export function OrderTimeline({
  status,
  history,
  createdAt,
  courier,
  tracking,
}: {
  status: string;
  history: { status: string; at: string }[];
  createdAt: Date;
  courier?: string | null;
  tracking?: string | null;
}) {
  const steps = buildTimeline(status, history, createdAt);
  const bad = status === "cancelled" || status === "returned";
  return (
    <ol className="space-y-0 text-start" aria-label="مراحل الطلب">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.key} className="flex gap-3" aria-current={s.state === "current" ? "step" : undefined}>
            <div className="flex flex-col items-center">
              <span
                className={cn("grid size-7 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold", s.state === "todo" && "opacity-50")}
                style={{
                  borderColor: s.state === "todo" ? "var(--border)" : bad && s.state === "current" ? "var(--foreground)" : "var(--primary)",
                  background: s.state === "done" ? "var(--primary)" : "transparent",
                  color: s.state === "done" ? "var(--primary-foreground)" : "var(--foreground)",
                }}
              >
                {s.state === "done" ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : i + 1}
              </span>
              {!last ? <span className="my-0.5 h-6 w-0.5 rounded-full" style={{ background: s.state === "done" ? "var(--primary)" : "var(--border)" }} aria-hidden="true" /> : null}
            </div>
            <div className={cn("pb-3 pt-0.5", s.state === "todo" && "opacity-55")}>
              <p className={cn("text-sm", s.state === "current" ? "font-black" : "font-bold")}>{s.label}</p>
              {s.at ? <p className="text-xs text-muted-foreground">{when(s.at)}</p> : null}
              {s.key === "shipped" && s.state !== "todo" && (courier || tracking) ? (
                <p className="mt-0.5 text-xs">
                  {courier ? <span>شركة الشحن: <b>{courier}</b></span> : null}
                  {courier && tracking ? " · " : null}
                  {tracking ? <span>رقم الشحنة: <b dir="ltr" className="select-all font-mono">{tracking}</b></span> : null}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
