// OverviewCards — بطاقات «نظرة عامة» (مكوّنات خادم بلا حالة): الفترة، والأرباح، وأحدث الطلبات،
// وجاهزية المتجر، والأكثر مبيعاً، والملاحظات. كل رابط فيها يعمل في المنصة وفي مشروع التاجر.
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Inbox,
  Lightbulb,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { fmtNum, arCount, NOUN } from "@/lib/format";
import { governorateName } from "@/lib/egypt";
import { orderStatusLabel, orderStatusTone, TONE_CHIP } from "@/lib/order-status";
import type { OverviewData, OverviewRange } from "@/server/repos/overview";
import type { Note } from "./notes";
import { GROUP_LABEL, readinessScore, type ReadyGroup, type ReadyStep } from "@/lib/store-readiness";

const RANGE_LABEL: Record<OverviewRange, string> = { 7: "7 أيام", 30: "30 يوماً", 90: "90 يوماً" };

export function RangeTabs({ active }: { active: OverviewRange }) {
  return (
    <nav aria-label="الفترة" className="inline-flex rounded-xl border border-edge/10 bg-edge/[0.03] p-1">
      {([7, 30, 90] as const).map((d) => (
        <Link
          key={d}
          href={d === 30 ? "/dashboard" : `/dashboard?range=${d}`}
          aria-current={d === active ? "page" : undefined}
          className={cn(
            "inline-flex min-h-9 items-center rounded-lg px-3 text-[12px] font-bold transition-colors",
            d === active ? "bg-nova text-white shadow-sm" : "text-ink-3 hover:bg-edge/5 hover:text-ink"
          )}
        >
          {RANGE_LABEL[d]}
        </Link>
      ))}
    </nav>
  );
}

function Card({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("dash-card p-4 sm:p-5", className)}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-black text-ink">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-9 items-center gap-1 text-[12px] font-bold text-nova-2 transition-colors hover:text-ink">
      {children}
      <ArrowLeft className="size-3.5" aria-hidden="true" />
    </Link>
  );
}

/** صافي مبيعات المنتجات والربح التقديري من سعر التكلفة (أو دعوة لإضافته إن لم يُضف بعد). */
export function EarningsCard({ data }: { data: OverviewData }) {
  const { current, profit } = data;
  const coverage = Math.round(profit.coverage * 100);
  return (
    <section className="dash-card grid gap-4 p-4 sm:grid-cols-2 sm:p-5" aria-label="الأرباح">
      <div>
        <p className="text-[12px] font-bold text-ink-2">صافي مبيعات المنتجات</p>
        <p className="mt-1.5 text-[24px] font-black tabular-nums text-ink sm:text-[28px]">{formatEgp(current.net)}</p>
        <p className="mt-1 text-[11.5px] leading-5 text-ink-3">ثمن المنتجات بعد الخصومات، بلا الشحن ورسوم التحصيل، في آخر {RANGE_LABEL[data.days]}.</p>
      </div>
      <div className="rounded-2xl border border-edge/[0.07] bg-edge/[0.02] p-3.5">
        <p className="flex items-center gap-1.5 text-[12px] font-bold text-ink-2">
          <PiggyBank className="size-4 text-ok" strokeWidth={2} aria-hidden="true" />
          الربح التقديري
        </p>
        {profit.profit === null ? (
          <>
            <p className="mt-1.5 text-[13px] font-bold leading-6 text-ink">أضف «سعر التكلفة» لمنتجاتك ليظهر ربحك هنا.</p>
            <Link href="/dashboard/products" className="mt-1 inline-flex min-h-9 items-center gap-1 text-[12px] font-black text-nova-2 hover:text-ink">
              إلى المنتجات
              <ArrowLeft className="size-3.5" aria-hidden="true" />
            </Link>
          </>
        ) : (
          <>
            <p className={cn("mt-1.5 text-[22px] font-black tabular-nums", profit.profit >= 0 ? "text-ok" : "text-bad")}>{formatEgp(profit.profit)}</p>
            <p className="mt-1 text-[11.5px] leading-5 text-ink-3">
              سعر البيع ناقص سعر التكلفة الحالي، بعد الخصومات.
              {coverage < 100 ? ` محسوب على ${fmtNum(coverage)}% من مبيعاتك؛ بقية المنتجات بلا سعر تكلفة.` : ""}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function timeAgo(d: Date): string {
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000));
  if (mins < 1) return "الآن";
  if (mins < 60) return mins === 1 ? "منذ دقيقة" : mins === 2 ? "منذ دقيقتين" : `منذ ${mins} ${mins <= 10 ? "دقائق" : "دقيقة"}`;
  const h = Math.round(mins / 60);
  if (h < 24) return h === 1 ? "منذ ساعة" : h === 2 ? "منذ ساعتين" : `منذ ${h} ${h <= 10 ? "ساعات" : "ساعة"}`;
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "short", timeZone: "Africa/Cairo" }).format(d);
}

export function RecentOrdersCard({ rows }: { rows: OverviewData["recentOrders"] }) {
  return (
    <Card title="أحدث الطلبات" action={rows.length ? <MoreLink href="/dashboard/orders">كل الطلبات</MoreLink> : null} className="lg:col-span-2">
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-edge/10 px-6 py-10 text-center">
          <Inbox className="size-6 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
          <p className="text-[13px] font-bold text-ink">لا طلبات بعد</p>
          <p className="text-[12px] text-ink-3">سيظهر هنا كل طلب فور وصوله، ومعه نغمة وتنبيه في أي صفحة من اللوحة.</p>
        </div>
      ) : (
        <ul className="-mx-2 divide-y divide-edge/[0.06]">
          {rows.map((o) => (
            <li key={o.id}>
              <Link
                href={`/dashboard/orders/${o.id}`}
                className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-edge/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-ink">{o.customerName}</span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">
                    <span dir="ltr">{o.code}</span> · {governorateName(o.governorate)} · {timeAgo(o.createdAt)}
                  </span>
                </span>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black", TONE_CHIP[orderStatusTone(o.status)])}>
                  {orderStatusLabel(o.status)}
                </span>
                <span className="w-[5.5rem] shrink-0 text-end text-[13px] font-black tabular-nums text-ink">{formatEgp(o.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ReadinessCard({ steps }: { steps: ReadyStep[] }) {
  const { pct, done, total } = readinessScore(steps);
  const groups = (Object.keys(GROUP_LABEL) as ReadyGroup[]).map((g) => ({ g, items: steps.filter((s) => s.group === g) })).filter((x) => x.items.length);
  const next = steps.find((s) => !s.ok && !s.optional);
  return (
    <Card title="جاهزية متجرك" action={<span className="text-[13px] font-black tabular-nums text-nova-2">{fmtNum(done)}/{fmtNum(total)}</span>}>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-edge/[0.06]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="نسبة الجاهزية">
        <div className="h-full rounded-full bg-gradient-to-l from-nova to-aurora" style={{ width: `${pct}%` }} />
      </div>
      {next ? (
        <Link href={next.href} className="mb-3 block rounded-xl bg-nova/10 p-3 transition hover:bg-nova/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova">
          <span className="block text-[11px] font-bold text-ink-3">الخطوة التالية</span>
          <span className="block text-[13px] font-black text-ink">{next.label}</span>
          <span className="mt-0.5 block text-[11.5px] leading-5 text-ink-3">{next.why}</span>
        </Link>
      ) : null}
      <div className="space-y-3">
        {groups.map(({ g, items }) => (
          <div key={g}>
            <p className="mb-1 text-[11px] font-black text-ink-3">{GROUP_LABEL[g]}</p>
            <ul className="-mx-1.5 space-y-0.5">
              {items.map((c) => (
                <li key={c.key}>
                  <Link
                    href={c.href}
                    title={c.why}
                    className={cn(
                      "flex min-h-10 items-center gap-2.5 rounded-lg px-1.5 text-[12.5px] transition-colors hover:bg-edge/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova",
                      c.ok ? "text-ink-3" : "font-bold text-ink"
                    )}
                  >
                    {c.ok ? (
                      <CheckCircle2 className="size-4 shrink-0 text-ok" strokeWidth={2.25} aria-label="مكتمل" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-ink-3/60" strokeWidth={1.75} aria-label="غير مكتمل" />
                    )}
                    <span className={cn("min-w-0 flex-1", c.ok && "line-through decoration-ink-3/40")}>
                      {c.label}
                      {c.optional ? <span className="ms-1 text-[10.5px] font-normal text-ink-3">(اختياري)</span> : null}
                    </span>
                    {c.detail && !c.ok ? <span className="shrink-0 text-[11px] font-bold tabular-nums text-ink-3">{c.detail}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function TopProductsCard({ rows, days }: { rows: OverviewData["topProducts"]; days: OverviewRange }) {
  return (
    <Card title="الأكثر مبيعاً" action={rows.length ? <MoreLink href="/dashboard/analytics">التحليلات</MoreLink> : null}>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-ink-3">لم يُبع شيء في آخر {RANGE_LABEL[days]}.</p>
      ) : (
        <ol className="space-y-2.5">
          {rows.map((p, i) => (
            <li key={`${p.productId}-${p.name}`} className="flex items-center gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-edge/[0.05] text-[12px] font-black tabular-nums text-ink-2">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-bold text-ink">{p.name}</span>
                <span className="block text-[11px] text-ink-3">{arCount(p.qty, NOUN.piece)}</span>
              </span>
              <span className="shrink-0 text-[12.5px] font-black tabular-nums text-ink">{formatEgp(p.revenue)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

const NOTE_ICON: Record<Note["tone"], LucideIcon> = { ok: TrendingUp, warn: TrendingDown, nova: Lightbulb };
const NOTE_TONE: Record<Note["tone"], string> = { ok: "bg-ok/12 text-ok", warn: "bg-warn/12 text-warn", nova: "bg-nova/12 text-nova-2" };

export function NotesCard({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return null;
  return (
    <section aria-labelledby="notes-title">
      <h2 id="notes-title" className="mb-2.5 text-[13px] font-black text-ink">
        ملاحظات من أرقامك
      </h2>
      <ul className={cn("grid gap-2.5", notes.length === 2 && "lg:grid-cols-2", notes.length >= 3 && "lg:grid-cols-3")}>
        {notes.map((n) => {
          const Icon = n.id === "first-order" || n.id === "silent-repeat" ? Lightbulb : NOTE_ICON[n.tone];
          return (
            <li key={n.id} className="dash-card flex flex-col gap-2 p-4">
              <div className="flex items-start gap-3">
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", NOTE_TONE[n.tone])}>
                  <Icon className="size-4" strokeWidth={2} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-black leading-6 text-ink">{n.title}</p>
                  <p className="mt-1 text-[12px] leading-6 text-ink-2">{n.body}</p>
                </div>
              </div>
              {n.action ? (
                <Link
                  href={n.action.href}
                  className="ms-12 inline-flex min-h-9 w-fit items-center gap-1 rounded-lg text-[12px] font-black text-nova-2 transition-colors hover:text-ink"
                >
                  {n.action.label}
                  <ArrowLeft className="size-3.5" aria-hidden="true" />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
