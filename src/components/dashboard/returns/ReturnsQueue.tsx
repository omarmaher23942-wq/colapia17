"use client";

// ReturnsQueue — طابور الاستبدال والاسترجاع وطلبات الإلغاء: الصور والسبب والقطع، وقرار التاجر بضغطة، ورسالة واتساب جاهزة لكل خطوة.
import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, MessageCircle, PackageCheck, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { fmtNum } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { timeAgo } from "../orders/parts";
import { cancelMessage, KIND_LABEL, nextReturnStatuses, returnMessage, STATUS_LABEL, type ReturnStatusKey } from "@/lib/returns";
import { createExchangeOrderAction, decideCancelAction, setReturnStatusAction } from "@/server/actions/returns";
import type { CancelRow, ReturnRow } from "@/server/repos/returns-list";
import { requestPulse } from "../DashboardPulse";

export type ReturnsTab = "open" | "cancel" | "closed";

const TABS: { key: ReturnsTab; label: string }[] = [
  { key: "open", label: "استبدال واسترجاع" },
  { key: "cancel", label: "طلبات الإلغاء" },
  { key: "closed", label: "المنتهية" },
];

const TONE: Record<ReturnStatusKey, string> = {
  new: "bg-nova/12 text-nova-2",
  approved: "bg-ok/12 text-ok",
  received: "bg-warn/12 text-warn",
  completed: "bg-ok/12 text-ok",
  rejected: "bg-bad/12 text-bad",
};

const ACTION_LABEL: Record<string, string> = { approved: "موافقة", rejected: "اعتذار", received: "استُلمت القطع", completed: "إنجاز الطلب" };

export function ReturnsQueue({ tab, returns, cancels, counts, storeName }: { tab: ReturnsTab; returns: ReturnRow[]; cancels: CancelRow[]; counts: { open: number; cancel: number }; storeName: string }) {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="border-b border-edge/10 pb-4">
        <h1 className="text-2xl font-black text-ink">الاستبدال والاسترجاع</h1>
        <p className="mt-1 text-[13px] leading-6 text-ink-2">القرار لكم في كل طلب. تظهر هنا طلبات العملاء من صفحة طلبهم مع الصور والسبب، وكل خطوة معها رسالة واتساب جاهزة.</p>
      </header>
      <nav aria-label="أقسام الطابور" className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "open" ? "/dashboard/returns" : `/dashboard/returns?tab=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={cn("inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-bold transition-colors", t.key === tab ? "border-nova bg-nova text-white" : "border-edge/10 text-ink-2 hover:bg-edge/[0.05]")}
          >
            {t.label}
            {t.key === "open" && counts.open ? <span className="rounded-full bg-black/15 px-1.5 text-[11px] tabular-nums">{fmtNum(counts.open)}</span> : null}
            {t.key === "cancel" && counts.cancel ? <span className="rounded-full bg-black/15 px-1.5 text-[11px] tabular-nums">{fmtNum(counts.cancel)}</span> : null}
          </Link>
        ))}
      </nav>
      {tab === "cancel" ? (
        cancels.length ? (
          <ul className="space-y-3">{cancels.map((c) => <CancelCard key={c.id} c={c} storeName={storeName} />)}</ul>
        ) : (
          <Empty>لا طلبات إلغاء من العملاء الآن.</Empty>
        )
      ) : returns.length ? (
        <ul className="space-y-3">{returns.map((r) => <ReturnCard key={r.id} r={r} storeName={storeName} />)}</ul>
      ) : (
        <Empty>{tab === "open" ? "لا طلبات استبدال أو استرجاع تنتظر قراركم." : "لا طلبات منتهية بعد."}</Empty>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="dash-card px-5 py-10 text-center text-[13px] leading-6 text-ink-2">{children}</p>;
}

function ReturnCard({ r, storeName }: { r: ReturnRow; storeName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [restock, setRestock] = useState(true);
  const [reps, setReps] = useState<Record<string, string>>({});
  const next = nextReturnStatuses(r.status);
  const msgTo = (to: ReturnStatusKey) => waLink(r.customerPhone, returnMessage(to, { name: r.customerName, code: r.orderCode, storeName, kind: r.kind, note }));

  const move = (to: "approved" | "rejected" | "received" | "completed") =>
    start(async () => {
      const res = await setReturnStatusAction({ id: r.id, to, note: note || undefined, restock: to === "received" ? restock : undefined }).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${STATUS_LABEL[to]}`);
      requestPulse();
      router.refresh();
    });

  const exchange = () =>
    start(async () => {
      const res = await createExchangeOrderAction({ returnId: r.id, replacements: Object.entries(reps).map(([orderItemId, variantId]) => ({ orderItemId, variantId })) }).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
      if (!res.ok) return void toast.error(res.error);
      toast.success(`أُنشئ طلب الاستبدال ${res.code}`);
      router.refresh();
    });

  const credit = r.lines.reduce((n, l) => n + l.unitPiasters * l.qty, 0);
  return (
    <li className="dash-card space-y-3 p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[14px] font-black text-ink">
            <span className="rounded-md bg-edge/[0.06] px-1.5 py-0.5 text-[11.5px]">{KIND_LABEL[r.kind]}</span>{" "}
            <Link href={`/dashboard/orders/${r.orderId}`} className="tabular-nums hover:underline">{r.orderCode}</Link> · {r.customerName}
          </p>
          <p className="mt-0.5 text-[11.5px] text-ink-3">{timeAgo(r.createdAt)}</p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-[11.5px] font-bold", TONE[r.status])}>{STATUS_LABEL[r.status]}</span>
      </header>
      <ul className="space-y-1 rounded-xl bg-edge/[0.04] p-3 text-[13px]">
        {r.lines.map((l) => (
          <li key={l.orderItemId} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">
              <b className="text-ink">{l.name}</b>
              {l.variant ? <span className="text-ink-2"> · {l.variant}</span> : null}
            </span>
            <span className="shrink-0 font-black tabular-nums text-ink">× {fmtNum(l.qty)}</span>
          </li>
        ))}
        <li className="flex justify-between border-t border-edge/10 pt-1 text-[12px] text-ink-2">
          <span>قيمة القطع الراجعة</span>
          <span className="tabular-nums">{formatEgp(credit)}</span>
        </li>
      </ul>
      {r.reason ? <p className="text-[13px] leading-6 text-ink"><span className="font-bold text-ink-2">السبب: </span>{r.reason}</p> : null}
      {r.photos.length ? (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="صور من العميل">
          {r.photos.map((src) => (
            <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="relative block size-20 shrink-0 overflow-hidden rounded-xl bg-edge/[0.06]">
              <Image src={src} alt="صورة من العميل" fill sizes="80px" className="object-cover" />
            </a>
          ))}
        </div>
      ) : null}
      {r.merchantNote ? <p className="text-[12px] text-ink-3">ملاحظتكم: {r.merchantNote}</p> : null}

      {next.length ? (
        <div className="space-y-2 border-t border-edge/10 pt-3">
          <input
            aria-label="ملاحظة للعميل (اختيارية)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="ملاحظة تُرسل مع الرسالة (اختيارية)"
            className="min-h-11 w-full rounded-xl border border-edge/10 bg-transparent px-3 text-[13px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
          />
          {next.includes("received") ? (
            <label className="flex min-h-10 items-center gap-2 text-[12.5px] font-bold text-ink">
              <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="size-4 accent-[var(--dash-nova,#6f86ff)]" />
              أعيدوا القطع للمخزون عند الاستلام
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {next.map((to) => (
              <button
                key={to}
                type="button"
                disabled={pending}
                onClick={() => move(to as "approved" | "rejected" | "received" | "completed")}
                className={cn("inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-black disabled:opacity-50", to === "rejected" ? "border border-bad/40 text-bad hover:bg-bad/10" : "bg-gradient-to-b from-nova to-nova-deep text-white shadow-sm")}
              >
                {to === "rejected" ? <X className="size-4" aria-hidden="true" /> : to === "received" ? <PackageCheck className="size-4" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
                {ACTION_LABEL[to]}
              </button>
            ))}
            {next.map((to) => {
              const href = msgTo(to);
              return href ? (
                <a key={`m-${to}`} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.06]">
                  <MessageCircle className="size-4" aria-hidden="true" />
                  رسالة «{STATUS_LABEL[to]}»
                </a>
              ) : null;
            })}
          </div>
        </div>
      ) : null}

      {r.kind === "exchange" && (r.status === "approved" || r.status === "received") ? (
        <div className="space-y-2 rounded-xl border border-edge/10 p-3">
          <p className="text-[12.5px] font-black text-ink">طلب الاستبدال الجديد</p>
          {r.exchangeOrderCode ? (
            <p className="text-[12.5px] text-ok">أُنشئ الطلب <b className="tabular-nums">{r.exchangeOrderCode}</b>.</p>
          ) : (
            <>
              <p className="text-[11.5px] leading-5 text-ink-3">يُنشأ طلب جديد بنفس بيانات العميل، وقيمة القطع الراجعة تُخصم منه، والفرق إن وُجد يُحصَّل عند الاستلام. المخزون يُخصم للقطع الجديدة.</p>
              {r.lines.filter((l) => l.productId && (r.variantsByProduct[l.productId]?.length ?? 0) > 0).map((l) => (
                <label key={l.orderItemId} className="block text-[12px] font-bold text-ink-2">
                  بديل «{l.name}»
                  <select
                    className="mt-1 min-h-11 w-full rounded-xl border border-edge/10 bg-transparent px-3 text-[13px] text-ink"
                    value={reps[l.orderItemId] ?? l.variantId ?? ""}
                    onChange={(e) => setReps((p) => ({ ...p, [l.orderItemId]: e.target.value }))}
                  >
                    {r.variantsByProduct[l.productId!]!.map((v) => (
                      <option key={v.id} value={v.id} disabled={!v.available || v.stock === 0}>
                        {v.label}{v.stock === 0 ? " (نفد)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <button type="button" disabled={pending} onClick={exchange} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-nova/40 px-4 text-[13px] font-black text-nova-2 hover:bg-nova/10 disabled:opacity-50">
                <RefreshCw className="size-4" aria-hidden="true" />
                إنشاء طلب الاستبدال
              </button>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}

function CancelCard({ c, storeName }: { c: CancelRow; storeName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const decide = (decision: "approved" | "declined") =>
    start(async () => {
      const res = await decideCancelAction({ orderId: c.id, decision, note: note || undefined }).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
      if (!res.ok) return void toast.error(res.error);
      toast.success(decision === "approved" ? "أُلغي الطلب وعاد المخزون" : "سُجّل الاعتذار");
      const href = waLink(c.customerPhone, cancelMessage(decision, { name: c.customerName, code: c.code, storeName, note }));
      if (href) window.open(href, "_blank", "noopener,noreferrer");
      requestPulse();
      router.refresh();
    });
  return (
    <li className="dash-card space-y-3 p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[14px] font-black text-ink">
          <Link href={`/dashboard/orders/${c.id}`} className="tabular-nums hover:underline">{c.code}</Link> · {c.customerName}
        </p>
        <span className="text-[12px] tabular-nums text-ink-2">{formatEgp(c.totalPiasters)} · {timeAgo(c.requestedAt)}</span>
      </header>
      <p className="text-[12.5px] leading-6 text-ink-2">طلب العميل إلغاء هذا الطلب. الموافقة تلغيه وتعيد المخزون، والاعتذار يُبقي الطلب كما هو. تُفتح رسالة واتساب جاهزة بعد القرار.</p>
      <input
        aria-label="ملاحظة للعميل (اختيارية)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        placeholder="ملاحظة تُرسل مع الرسالة (اختيارية)"
        className="min-h-11 w-full rounded-xl border border-edge/10 bg-transparent px-3 text-[13px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => decide("approved")} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-4 text-[13px] font-black text-white disabled:opacity-50">
          <Check className="size-4" aria-hidden="true" />
          موافقة وإلغاء الطلب
        </button>
        <button type="button" disabled={pending} onClick={() => decide("declined")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-bad/40 px-4 text-[13px] font-black text-bad hover:bg-bad/10 disabled:opacity-50">
          <X className="size-4" aria-hidden="true" />
          اعتذار
        </button>
      </div>
    </li>
  );
}
