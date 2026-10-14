// PrepRoom — «غرفة التجهيز» لمتجر نور للملابس (مكوّن خادم). ثلاث نوافذ على نفس الطلبات:
//   pick: كل قطعة بمقاسها وكميتها الإجمالية (ما تسحبه من المخزن أو تطلبه من المورد اليوم)،
//   pack: بطاقة لكل طلب (العميل والعنوان والقطع والمبلغ المطلوب تحصيله) تُطبع وتُرفق بالشحنة،
//   sizes: كم بيع من كل مقاس في الفترة ومن ينتظر توفره، لقرار الكميات من المورد.
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ClipboardList, PackageCheck, Ruler, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { fmtNum, arCount, NOUN } from "@/lib/format";
import { governorateName } from "@/lib/egypt";
import { orderStatusLabel, orderStatusTone, paymentMethodLabel, TONE_CHIP } from "@/lib/order-status";
import type { PrepData, PrepScope } from "@/server/repos/store-extras/prep-room";
import { PrintButton } from "./PrintButton";

export type PrepTab = "pick" | "pack" | "sizes";

const TABS: { key: PrepTab; label: string; icon: typeof ClipboardList }[] = [
  { key: "pick", label: "قائمة التجهيز", icon: ClipboardList },
  { key: "pack", label: "بطاقات التعبئة", icon: PackageCheck },
  { key: "sizes", label: "طلب المقاسات", icon: Ruler },
];

const href = (tab: PrepTab, scope: PrepScope, days?: number) => {
  const q = new URLSearchParams();
  if (tab !== "pick") q.set("tab", tab);
  if (scope !== "ready") q.set("scope", scope);
  if (days && days !== 30) q.set("days", String(days));
  const s = q.toString();
  return `/dashboard/prep${s ? `?${s}` : ""}`;
};

// الطباعة: منطقة الصفحة وحدها بلا القائمة والشريط العلوي.
const PRINT_CSS = `@media print{body *{visibility:hidden!important}#prep-print,#prep-print *{visibility:visible!important}#prep-print{position:absolute;inset:0;padding:0 8mm;color:#000}#prep-print .dash-card{border:1px solid #bbb!important;box-shadow:none!important;break-inside:avoid}}`;

function Pill({ active, href: to, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      aria-current={active ? "page" : undefined}
      className={cn("inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-lg px-2.5 text-[12px] font-bold transition-colors sm:px-3", active ? "bg-nova text-white shadow-sm" : "text-ink-3 hover:bg-edge/5 hover:text-ink")}
    >
      {children}
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="dash-card px-5 py-10 text-center text-[13px] leading-6 text-ink-2">{children}</p>;
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  return (
    <span className="relative block size-14 shrink-0 overflow-hidden rounded-xl bg-edge/[0.06]">
      {src ? <Image src={src} alt={alt} fill sizes="56px" className="object-cover" /> : null}
    </span>
  );
}

const collect = (o: PrepData["pack"][number]) => (o.paymentMethod === "cod" && o.paymentStatus !== "confirmed" ? o.totalPiasters : 0);

export function PrepRoom({ data, tab, scope }: { data: PrepData; tab: PrepTab; scope: PrepScope }) {
  const pieces = data.pick.reduce((n, l) => n + l.qty, 0);
  const toCollect = data.pack.reduce((n, o) => n + collect(o), 0);
  const topSize = data.demand.flatMap((d) => d.sizes.map((s) => ({ ...s, name: d.name }))).sort((a, b) => b.sold - a.sold)[0];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <style>{PRINT_CSS}</style>
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-edge/10 pb-4">
        <div>
          <h1 className="text-2xl font-black text-ink">غرفة التجهيز</h1>
          <p className="mt-1 text-[13px] leading-6 text-ink-2">كل ما تحتاجه لتجهيز طلبات اليوم بلا أخطاء في المقاس، وقرار الكميات من المورد.</p>
        </div>
        {tab !== "sizes" && (data.pick.length || data.pack.length) ? <PrintButton label={tab === "pack" ? "طباعة البطاقات" : "طباعة القائمة"} /> : null}
      </header>

      <section aria-label="ملخص" className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="dash-card p-3 sm:p-4">
          <p className="text-[11.5px] font-bold text-ink-2">طلبات للتجهيز</p>
          <p className="mt-1 text-[22px] font-black tabular-nums text-ink">{fmtNum(data.pack.length)}</p>
        </div>
        <div className="dash-card p-3 sm:p-4">
          <p className="text-[11.5px] font-bold text-ink-2">قطع مطلوبة</p>
          <p className="mt-1 text-[22px] font-black tabular-nums text-ink">{fmtNum(pieces)}</p>
        </div>
        <div className="dash-card p-3 sm:p-4">
          <p className="text-[11.5px] font-bold text-ink-2">للتحصيل</p>
          <p className="mt-1 text-[18px] font-black tabular-nums text-ink sm:text-[22px]">{formatEgp(toCollect)}</p>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <nav aria-label="العرض" className="grid w-full grid-cols-3 gap-1 rounded-xl border border-edge/10 bg-edge/[0.03] p-1 sm:inline-flex sm:w-auto">
          {TABS.map((t) => (
            <Pill key={t.key} active={t.key === tab} href={href(t.key, scope, data.days)}>
              <t.icon className="me-1.5 hidden size-4 min-[400px]:inline sm:inline" aria-hidden="true" />
              {t.label}
            </Pill>
          ))}
        </nav>
        {tab === "sizes" ? (
          <nav aria-label="الفترة" className="inline-flex rounded-xl border border-edge/10 bg-edge/[0.03] p-1">
            <Pill active={data.days === 30} href={href("sizes", scope, 30)}>30 يوماً</Pill>
            <Pill active={data.days === 90} href={href("sizes", scope, 90)}>90 يوماً</Pill>
          </nav>
        ) : (
          <nav aria-label="الطلبات" className="inline-flex rounded-xl border border-edge/10 bg-edge/[0.03] p-1">
            <Pill active={scope === "ready"} href={href(tab, "ready")}>المؤكدة فقط</Pill>
            <Pill active={scope === "all"} href={href(tab, "all")}>مع الجديدة</Pill>
          </nav>
        )}
      </div>

      <div id="prep-print">
        {tab === "pick" ? <PickList data={data} scope={scope} /> : tab === "pack" ? <PackCards data={data} scope={scope} /> : <SizeDemandView data={data} topSize={topSize} />}
      </div>
    </div>
  );
}

function PickList({ data, scope }: { data: PrepData; scope: PrepScope }) {
  if (!data.pick.length)
    return <Empty>{scope === "ready" ? "لا طلبات مؤكدة تنتظر التجهيز الآن. أكّد الطلبات الجديدة من صفحة الطلبات لتظهر هنا، أو اعرض «مع الجديدة»." : "لا طلبات تنتظر التجهيز الآن."}</Empty>;
  return (
    <section className="dash-card divide-y divide-edge/[0.07]" aria-label="قائمة التجهيز">
      {data.pick.map((l) => (
        <div key={l.key} className="flex items-center gap-3 p-3 sm:p-4">
          <Thumb src={l.image} alt={l.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-black text-ink">{l.name}</p>
            {l.variant ? <p className="mt-0.5 text-[12.5px] font-bold text-ink-2">المقاس/الخيار: {l.variant}</p> : null}
            <p className="mt-1 flex flex-wrap gap-1.5 text-[11.5px] text-ink-3">
              {l.orders.map((o) => (
                <Link key={o.id} href={`/dashboard/orders/${o.id}`} className="rounded-md bg-edge/[0.05] px-1.5 py-0.5 font-bold tabular-nums hover:text-ink">
                  {o.code}
                </Link>
              ))}
            </p>
          </div>
          <span className="grid min-w-14 place-items-center rounded-xl bg-nova/12 px-3 py-2 text-center">
            <span className="text-[20px] font-black leading-none tabular-nums text-ink">{fmtNum(l.qty)}</span>
            <span className="mt-0.5 text-[10.5px] font-bold text-ink-2">قطعة</span>
          </span>
        </div>
      ))}
    </section>
  );
}

function PackCards({ data, scope }: { data: PrepData; scope: PrepScope }) {
  if (!data.pack.length) return <Empty>{scope === "ready" ? "لا طلبات مؤكدة للتعبئة الآن." : "لا طلبات تنتظر التعبئة الآن."}</Empty>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {data.pack.map((o) => {
        const due = collect(o);
        return (
          <article key={o.id} className="dash-card p-4">
            <header className="flex items-start justify-between gap-2">
              <div>
                <Link href={`/dashboard/orders/${o.id}`} className="text-[15px] font-black tabular-nums text-ink hover:underline">
                  {o.code}
                </Link>
                <p className="mt-0.5 text-[11.5px] text-ink-3">{new Date(o.createdAt).toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "long", timeZone: "Africa/Cairo" })}</p>
              </div>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold print:hidden", TONE_CHIP[orderStatusTone(o.status)])}>{orderStatusLabel(o.status)}</span>
            </header>
            <dl className="mt-3 space-y-1 text-[13px] leading-6 text-ink">
              <div className="flex gap-2"><dt className="w-14 shrink-0 font-bold text-ink-3">العميل</dt><dd className="min-w-0">{o.customerName} · <span dir="ltr" className="tabular-nums">{o.customerPhone}</span></dd></div>
              <div className="flex gap-2"><dt className="w-14 shrink-0 font-bold text-ink-3">العنوان</dt><dd className="min-w-0">{governorateName(o.governorate)}{o.city ? `، ${o.city}` : ""}، {o.address}{o.landmark ? ` (${o.landmark})` : ""}</dd></div>
              {o.notes ? <div className="flex gap-2"><dt className="w-14 shrink-0 font-bold text-ink-3">ملاحظة</dt><dd className="min-w-0">{o.notes}</dd></div> : null}
            </dl>
            <ul className="mt-3 space-y-1.5 rounded-xl bg-edge/[0.04] p-3 text-[13px]">
              {o.items.map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span aria-hidden="true" className="me-1.5 inline-block size-3.5 rounded border border-edge/30 align-middle" />
                    <span className="font-bold text-ink">{it.name}</span>
                    {it.variant ? <span className="text-ink-2"> · {it.variant}</span> : null}
                  </span>
                  <span className="shrink-0 font-black tabular-nums text-ink">× {fmtNum(it.qty)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-center justify-between text-[13px]">
              <span className="font-bold text-ink-2">{paymentMethodLabel(o.paymentMethod)}</span>
              <span className="font-black tabular-nums text-ink">{due ? `تحصيل ${formatEgp(due)}` : "مدفوع مسبقاً"}</span>
            </p>
          </article>
        );
      })}
    </div>
  );
}

function SizeDemandView({ data, topSize }: { data: PrepData; topSize?: { label: string; sold: number; name: string } }) {
  if (!data.demand.length)
    return <Empty>لا مبيعات لقطع بمقاسات في آخر {data.days === 90 ? "90 يوماً" : "30 يوماً"} بعد. مع أول الطلبات يظهر هنا أكثر المقاسات طلباً لكل قطعة، ومن ينتظر توفر مقاس نفد.</Empty>;
  return (
    <div className="space-y-3">
      {topSize && topSize.sold > 0 ? (
        <p className="dash-card flex items-center gap-2 p-3 text-[13px] leading-6 text-ink">
          <Ruler className="size-4 shrink-0 text-nova-2" aria-hidden="true" />
          الأكثر طلباً: <b>{topSize.name}</b> مقاس <b className="tabular-nums">{topSize.label}</b> ({arCount(topSize.sold, NOUN.piece)}).
        </p>
      ) : null}
      {data.demand.map((d) => {
        const max = Math.max(1, ...d.sizes.map((s) => s.sold + s.waiting));
        return (
          <section key={d.productId} className="dash-card p-4" aria-label={d.name}>
            <header className="mb-3 flex items-center gap-3">
              <Thumb src={d.image} alt={d.name} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[14px] font-black text-ink">{d.name}</h2>
                <p className="mt-0.5 text-[12px] text-ink-2">
                  بيع {fmtNum(d.sold)} في آخر {data.days === 90 ? "90 يوماً" : "30 يوماً"}
                  {d.waiting ? <> · <BellRing className="inline size-3.5 align-[-2px] text-warn" aria-hidden="true" /> {fmtNum(d.waiting)} ينتظرون التوفر</> : null}
                </p>
              </div>
              {d.waiting ? (
                <Link href={`/dashboard/products/${d.productId}`} className="inline-flex min-h-9 shrink-0 items-center gap-1 text-[12px] font-bold text-nova-2 hover:text-ink">
                  المنتظرون
                  <ArrowLeft className="size-3.5" aria-hidden="true" />
                </Link>
              ) : null}
            </header>
            <ul className="space-y-1.5">
              {d.sizes.map((s) => (
                <li key={s.label} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-2 text-[12.5px]">
                  <span className="truncate font-black tabular-nums text-ink">{s.label}</span>
                  <span className="flex h-3 overflow-hidden rounded-full bg-edge/[0.06]" aria-hidden="true">
                    <span className="h-full bg-nova" style={{ width: `${(s.sold / max) * 100}%` }} />
                    <span className="h-full bg-warn/70" style={{ width: `${(s.waiting / max) * 100}%` }} />
                  </span>
                  <span className="whitespace-nowrap tabular-nums text-ink-2">
                    {fmtNum(s.sold)} بيع{s.waiting ? ` · ${fmtNum(s.waiting)} ينتظر` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="text-[11.5px] leading-5 text-ink-3">المبيعات بلا الطلبات الملغاة والمرتجعة والتجريبية. «ينتظر» = من طلب تنبيهه عند توفر المقاس ولم يُبلَّغ بعد.</p>
    </div>
  );
}
