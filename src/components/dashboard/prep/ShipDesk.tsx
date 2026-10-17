"use client";

// ShipDesk — صفحة «الشحن»: اختيار الطلبات وشركة الشحن وتنزيل ملف الرفع الجماعي، ثم أرقام التتبع، ثم تسوية التحصيل.
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Download, ExternalLink, MessageCircle, Printer, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { arCount, fmtNum, NOUN } from "@/lib/format";
import { governorateName } from "@/lib/egypt";
import { waLink } from "@/lib/whatsapp";
import { COURIERS, COURIER_INFO, codAmountEgp, shippedMessage, trackingUrl, type CourierKey } from "@/lib/courier-export";
import { reconcileCod, type CodOrder } from "@/lib/cod-reconcile";
import { exportShipmentsAction, saveTrackingAction, setCodSettledAction } from "@/server/actions/shipping-ops";
import type { ShipRow } from "@/server/repos/ship";

export type ShipTab = "ready" | "shipped" | "cod";

const TABS: { key: ShipTab; label: string }[] = [
  { key: "ready", label: "جاهزة للشحن" },
  { key: "shipped", label: "تم شحنها" },
  { key: "cod", label: "تسوية التحصيل" },
];

const field = "min-h-11 w-full rounded-xl border border-edge/10 bg-transparent px-3 text-[13px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova";

function download(filename: string, mime: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ShipDesk({ tab, ready, shipped, cod, storeName }: { tab: ShipTab; ready: ShipRow[]; shipped: ShipRow[]; cod: CodOrder[]; storeName: string }) {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="border-b border-edge/10 pb-4">
        <h1 className="text-2xl font-black text-ink">الشحن</h1>
        <p className="mt-1 text-[13px] leading-6 text-ink-2">صدّروا الطلبات بصيغة شركة الشحن، وسجّلوا أرقام التتبع، وتابعوا ما حُصّل وما لم يصلكم بعد.</p>
      </header>
      <nav aria-label="أقسام الشحن" className="grid grid-cols-3 gap-1 rounded-xl border border-edge/10 bg-edge/[0.03] p-1 sm:inline-flex">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "ready" ? "/dashboard/orders/ship" : `/dashboard/orders/ship?tab=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={cn("inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-lg px-3 text-[12px] font-bold transition-colors", t.key === tab ? "bg-nova text-white shadow-sm" : "text-ink-3 hover:bg-edge/5 hover:text-ink")}
          >
            {t.label}
            {t.key === "ready" && ready.length ? <span className="ms-1.5 rounded-full bg-black/15 px-1.5 text-[11px] tabular-nums">{fmtNum(ready.length)}</span> : null}
          </Link>
        ))}
      </nav>
      {tab === "ready" ? <ReadyTab rows={ready} /> : tab === "shipped" ? <ShippedTab rows={shipped} storeName={storeName} /> : <CodTab rows={cod} />}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="dash-card px-5 py-10 text-center text-[13px] leading-6 text-ink-2">{children}</p>;
}

function ReadyTab({ rows }: { rows: ShipRow[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [courier, setCourier] = useState<CourierKey>("bosta");
  const [format, setFormat] = useState<"csv" | "xlsx">("xlsx");
  const [mark, setMark] = useState(true);
  const [pending, start] = useTransition();
  const chosen = useMemo(() => rows.filter((r) => sel.has(r.id)), [rows, sel]);
  const collect = chosen.reduce((n, r) => n + codAmountEgp(r), 0);
  const toggle = (id: string) => setSel((p) => (p.has(id) ? new Set([...p].filter((x) => x !== id)) : new Set([...p, id])));

  if (!rows.length) return <Empty>لا طلبات جاهزة للشحن الآن. أكّدوا الطلبات الجديدة من صفحة الطلبات لتظهر هنا.</Empty>;

  const run = () =>
    start(async () => {
      const r = await exportShipmentsAction({ ids: [...sel], courier, format, markShipped: mark }).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
      if (!r.ok) return void toast.error(r.error);
      download(r.filename, r.mime, r.base64);
      toast.success(mark && r.shipped ? `نُزّل الملف وعُلّم ${arCount(r.shipped, NOUN.order)} «تم الشحن»` : "نُزّل الملف");
      if (r.skipped.length) toast.message(`لم تُعلَّم: ${r.skipped.join("، ")}`);
      setSel(new Set());
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <section className="dash-card space-y-3 p-4" aria-label="تصدير للشحن">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-[12px] font-bold text-ink-2">
            شركة الشحن
            <select className={cn(field, "mt-1")} value={courier} onChange={(e) => setCourier(e.target.value as CourierKey)}>
              {COURIERS.map((k) => (
                <option key={k} value={k}>
                  {COURIER_INFO[k].label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-bold text-ink-2">
            صيغة الملف
            <select className={cn(field, "mt-1")} value={format} onChange={(e) => setFormat(e.target.value as "csv" | "xlsx")}>
              <option value="xlsx">Excel (XLSX)</option>
              <option value="csv">CSV</option>
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 self-end text-[12.5px] font-bold text-ink">
            <input type="checkbox" checked={mark} onChange={(e) => setMark(e.target.checked)} className="size-4 accent-[var(--dash-nova,#6f86ff)]" />
            علّموا الطلبات «تم الشحن» بعد التصدير
          </label>
        </div>
        <p className="text-[11.5px] leading-5 text-ink-3">الأعمدة بصيغة قالب الرفع الجماعي الشائع لدى {COURIER_INFO[courier].label}، وقد تطلب الشركة مطابقة اسم عمود عند الرفع. مبلغ التحصيل = الإجمالي ناقص ما دُفع مسبقاً.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!sel.size || pending}
            onClick={run}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-4 text-[13px] font-black text-white shadow-md disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2"
          >
            <Download className="size-4" aria-hidden="true" />
            {pending ? "جارٍ التجهيز" : `تنزيل ملف ${COURIER_INFO[courier].label}`}
          </button>
          {sel.size ? (
            <Link
              href={`/print/labels?ids=${[...sel].slice(0, 100).join(",")}`}
              target="_blank"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-edge/10 bg-edge/[0.04] px-4 text-[13px] font-bold text-ink hover:bg-edge/[0.08]"
            >
              <Printer className="size-4" aria-hidden="true" />
              ملصقات الشحن
            </Link>
          ) : null}
          <span className="text-[12px] text-ink-2">
            {sel.size ? `${arCount(sel.size, NOUN.order)} · تحصيل ${formatEgp(Math.round(collect * 100))}` : "حدّدوا الطلبات أولاً"}
          </span>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setSel(sel.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)))} className="min-h-10 text-[12.5px] font-bold text-nova-2 hover:text-ink">
          {sel.size === rows.length ? "إلغاء التحديد" : "تحديد الكل"}
        </button>
      </div>
      <ul className="dash-card divide-y divide-edge/[0.07]">
        {rows.map((r) => (
          <li key={r.id}>
            <label className="flex cursor-pointer items-start gap-3 p-3 sm:p-4">
              <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} className="mt-1 size-5 shrink-0 accent-[var(--dash-nova,#6f86ff)]" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 text-[13.5px] font-black text-ink">
                  <span className="tabular-nums">{r.code}</span>
                  <span className="font-bold text-ink-2">{r.customerName}</span>
                  {r.gift ? <span className="rounded-full bg-warn/15 px-2 text-[10.5px] text-warn">هدية</span> : null}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                  {governorateName(r.governorate)}
                  {r.city ? `، ${r.city}` : ""} · {r.items.map((i) => `${i.name}${i.variant ? ` (${i.variant})` : ""} × ${i.qty}`).join("، ")}
                </span>
              </span>
              <span className="shrink-0 text-end text-[12px] font-black tabular-nums text-ink">{codAmountEgp(r) > 0 ? formatEgp(Math.round(codAmountEgp(r) * 100)) : <span className="font-bold text-ok">مدفوع</span>}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShippedTab({ rows, storeName }: { rows: ShipRow[]; storeName: string }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!rows.length) return <Empty>لا شحنات في الطريق. عند تصدير طلبات وتعليمها «تم الشحن» تظهر هنا لتسجيل أرقام التتبع.</Empty>;
  const dirty = Object.entries(vals).filter(([id, v]) => v.trim() && v.trim() !== (rows.find((r) => r.id === id)?.trackingNumber ?? ""));
  const save = () =>
    start(async () => {
      const r = await saveTrackingAction(dirty.map(([id, trackingNumber]) => ({ id, trackingNumber }))).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
      if (!r.ok) return void toast.error(r.error);
      toast.success(`حُفظ ${arCount(r.saved, NOUN.order)}`);
      setVals({});
      router.refresh();
    });
  return (
    <div className="space-y-3">
      <ul className="dash-card divide-y divide-edge/[0.07]">
        {rows.map((r) => {
          const tracking = vals[r.id] ?? r.trackingNumber ?? "";
          const url = trackingUrl(r.courierName, r.trackingNumber);
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-[13.5px] font-black text-ink">
                  <Link href={`/dashboard/orders/${r.id}`} className="tabular-nums hover:underline">{r.code}</Link> · {r.customerName}
                </p>
                <p className="text-[12px] text-ink-3">{r.courierName ?? "شركة غير محددة"} · {r.shippedAt ? new Date(r.shippedAt).toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "long", timeZone: "Africa/Cairo" }) : ""}</p>
              </div>
              <input
                aria-label={`رقم تتبع ${r.code}`}
                dir="ltr"
                className={cn(field, "max-w-52")}
                placeholder="رقم الشحنة"
                value={tracking}
                onChange={(e) => setVals((p) => ({ ...p, [r.id]: e.target.value }))}
              />
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 text-[12px] font-bold text-nova-2 hover:text-ink">
                  تتبع <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              ) : null}
              {r.trackingNumber ? (
                <a
                  href={waLink(r.customerPhone, shippedMessage(r, storeName)) ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-edge/10 px-3 text-[12px] font-bold text-ink hover:bg-edge/[0.06]"
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  إبلاغ العميل
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={!dirty.length || pending}
        onClick={save}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[13px] font-black text-white shadow-md disabled:opacity-50"
      >
        <Save className="size-4" aria-hidden="true" />
        حفظ أرقام التتبع
      </button>
    </div>
  );
}

function CodTab({ rows }: { rows: CodOrder[] }) {
  const router = useRouter();
  const groups = useMemo(() => reconcileCod(rows), [rows]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  if (!groups.length) return <Empty>لا طلبات استلام مسلَّمة في آخر 120 يوماً. عند تسليم طلبات الدفع عند الاستلام تظهر هنا مع ما ينتظر وصوله من الشركات.</Empty>;
  const settle = (ids: string[], settled: boolean) =>
    start(async () => {
      const r = await setCodSettledAction(ids, settled).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
      if (!r.ok) return void toast.error(r.error);
      toast.success(settled ? `سُجّلت تسوية ${arCount(r.done, NOUN.order)}` : "أُلغيت التسوية");
      setSel(new Set());
      router.refresh();
    });
  const pendingTotal = groups.reduce((n, g) => n + g.pendingPiasters, 0);
  return (
    <div className="space-y-4">
      <p className="dash-card flex items-center justify-between gap-3 p-4 text-[13px] text-ink">
        <span className="font-bold text-ink-2">مبالغ مسلَّمة لم تصلكم بعد</span>
        <b className="text-[18px] tabular-nums">{formatEgp(pendingTotal)}</b>
      </p>
      {groups.map((g) => (
        <section key={g.courier} className="dash-card p-4" aria-label={g.courier}>
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[14px] font-black text-ink">{g.courier}</h2>
            <p className="text-[12px] text-ink-2">
              مسلَّم {arCount(g.deliveredCount, NOUN.order)} · {formatEgp(g.deliveredPiasters)} · وصل {formatEgp(g.settledPiasters)} · <b className="text-ink">المتبقي {formatEgp(g.pendingPiasters)}</b>
            </p>
          </header>
          {g.pending.length ? (
            <>
              <ul className="mt-3 divide-y divide-edge/[0.07]">
                {g.pending.map((o) => (
                  <li key={o.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1.5 text-[13px]">
                      <input
                        type="checkbox"
                        checked={sel.has(o.id)}
                        onChange={() => setSel((p) => (p.has(o.id) ? new Set([...p].filter((x) => x !== o.id)) : new Set([...p, o.id])))}
                        className="size-5 accent-[var(--dash-nova,#6f86ff)]"
                      />
                      <span className="flex-1 font-bold tabular-nums text-ink">{o.code}</span>
                      <span className="tabular-nums text-ink-2">{formatEgp(o.collectPiasters)}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" disabled={pending || !g.pending.some((o) => sel.has(o.id))} onClick={() => settle(g.pending.filter((o) => sel.has(o.id)).map((o) => o.id), true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ok px-4 text-[13px] font-black text-white disabled:opacity-50">
                  <Check className="size-4" aria-hidden="true" />
                  وصل المبلغ للمحدد
                </button>
                <button type="button" disabled={pending} onClick={() => settle(g.pending.map((o) => o.id), true)} className="min-h-11 rounded-xl border border-edge/10 px-4 text-[13px] font-bold text-ink hover:bg-edge/[0.06] disabled:opacity-50">
                  وصل كل مستحقات {g.courier}
                </button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-[12.5px] font-bold text-ok">كل مستحقات هذه الشركة وصلت.</p>
          )}
        </section>
      ))}
      <p className="text-[11.5px] leading-5 text-ink-3">«وصل المبلغ» يسجّل أنكم استلمتم من الشركة قيمة تحصيل الطلب، ويُحفظ كوسم على الطلب. الأرقام من طلبات آخر 120 يوماً.</p>
    </div>
  );
}
