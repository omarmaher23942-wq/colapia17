// dashboard/billing — دفع Colapia (مرة واحدة) على المنصة فقط. الصفحة تعرض مرحلة التاجر كما هي (lib/billing-stage.ts):
//  - الدفع: التجربة الجارية بموعد التجميد والحذف، أو انتهاؤها، أو التجميد، أو رفض إيصال سابق بسببه؛ ثم نموذج التحويل.
//  - قيد المراجعة: الإيصال المرسَل وخطوات ما بعده (المالك يراجع بنفسه؛ لا موعد نَعِد به). تتحدث تلقائياً عند القبول.
//  - مفعّل: الخطوة التالية «امتلك متجرك». ومستلَم: لا شيء مطلوب.
// السعر من platformPricing (نفس الهبوط والتحقق من الإيصال)، وأرقام التحويل من متغيرات المنصة.
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Clock, ExternalLink, Hourglass, Lock, PartyPopper, Receipt, Snowflake, XCircle } from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { db } from "@/db/client";
import { platformPayments } from "@/db/schema";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/format";
import { formatEgp } from "@/lib/money";
import { prettyPhone } from "@/lib/phone";
import { platformPricing } from "@/lib/platform-pricing";
import { billingStage, type BillingPayment, type BillingStage } from "@/lib/billing-stage";
import { ownWindow, type OwnWindow } from "@/lib/ownership-window";
import { PayForm } from "@/components/dashboard/billing/PayForm";
import { AutoRefresh } from "@/components/platform/AutoRefresh";

export const dynamic = "force-dynamic";
export const metadata = { title: "الدفع والتفعيل" };

const METHOD: Record<string, string> = { vodafone_cash: "فودافون كاش", instapay: "إنستاباي", cod: "نقداً" };

const dateFmt = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" });
const shortFmt = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" });
const when = (d: Date) => dateFmt.format(d);

/** «بعد 5 ساعات»، «بعد 3 أيام»، «خلال دقائق». */
function inTime(d: Date, now: number): string {
  const ms = d.getTime() - now;
  if (ms <= 10 * 60e3) return "خلال دقائق";
  const h = Math.round(ms / 36e5);
  if (h < 1) return `بعد ${fmtNum(Math.max(1, Math.round(ms / 60e3)))} دقيقة`;
  if (h < 48) return h === 1 ? "بعد ساعة" : h === 2 ? "بعد ساعتين" : `بعد ${fmtNum(h)} ${h <= 10 ? "ساعات" : "ساعة"}`;
  const days = Math.round(ms / 864e5);
  return `بعد ${fmtNum(days)} ${days <= 10 ? "أيام" : "يوماً"}`;
}

export default async function BillingPage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/billing");
  if (!session.store) redirect("/dashboard/onboarding");
  const store = session.store;

  const payments = (await db
    .select({
      id: platformPayments.id,
      status: platformPayments.status,
      method: platformPayments.method,
      amountPiasters: platformPayments.amountPiasters,
      senderPhone: platformPayments.senderPhone,
      screenshotUrl: platformPayments.screenshotUrl,
      reviewNote: platformPayments.reviewNote,
      reviewedAt: platformPayments.reviewedAt,
      createdAt: platformPayments.createdAt,
    })
    .from(platformPayments)
    .where(eq(platformPayments.storeId, store.id))
    .orderBy(desc(platformPayments.createdAt))
    .limit(20)) as BillingPayment[];

  const now = Date.now();
  const stage = billingStage(store, payments, env.GRACE_DAYS, new Date(now));
  const pricing = platformPricing();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {stage.kind === "review" ? <AutoRefresh everyMs={15000} /> : null}
      <header>
        <h1 className="text-xl font-black text-ink">الدفع والتفعيل</h1>
        <p className="mt-1 text-[12.5px] text-ink-3">
          {fmtNum(pricing.price)} ج.م مرة واحدة لمتجر {store.name}، بلا اشتراك ولا عمولة على مبيعاتك.
        </p>
      </header>

      {stage.kind === "pay" ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="space-y-4">
            <PhaseBanner stage={stage} now={now} />
            <PayForm price={pricing.price} vodafone={env.VODAFONE_CASH_NUMBER} instapay={env.INSTAPAY_NUMBER} />
          </div>
          <Offer price={pricing.price} basePrice={pricing.basePrice} />
        </div>
      ) : null}

      {stage.kind === "review" ? <InReview payment={stage.payment} /> : null}
      {stage.kind === "active" ? <Activated activatedAt={stage.activatedAt} payment={stage.payment} window={ownWindow(store)} now={now} /> : null}
      {stage.kind === "owned" ? (
        <StateCard tone="ok" icon={CheckCircle2} title="استلمت متجرك" text="متجرك يعمل على حساباتك أنت، ولا شيء مطلوب منك هنا.">
          <CtaLink href="/dashboard/own">روابط موقعك الجديد</CtaLink>
        </StateCard>
      ) : null}
      {stage.kind === "unavailable" ? <Unavailable reason={stage.reason} /> : null}

      {/* سجل الإيصالات حين يضيف شيئاً لما في الأعلى (أكثر من إيصال، أو المتجر مفعّل). */}
      {payments.length > 1 || (payments.length === 1 && stage.kind !== "review") ? <History payments={payments} /> : null}
    </div>
  );
}

function PhaseBanner({ stage, now }: { stage: Extract<BillingStage, { kind: "pay" }>; now: number }) {
  const del = stage.deleteAt;
  const rejected = stage.rejected ? (
    <div className="flex items-start gap-3 rounded-2xl border border-bad/30 bg-bad/[0.06] p-4">
      <XCircle className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden="true" />
      <div className="min-w-0 text-[12.5px] leading-6">
        <p className="font-black text-ink">لم نقبل إيصالك السابق</p>
        <p className="text-ink-2">{stage.rejected.reviewNote?.trim() || "لم نتمكن من التأكد من وصول التحويل."}</p>
        <p className="text-ink-3">إن كنت حوّلت فعلاً، أرسل صورة أوضح يظهر فيها المبلغ والتاريخ ورقم العملية.</p>
      </div>
    </div>
  ) : null;

  const box = (() => {
    if (stage.phase === "trial" && stage.freezeAt) {
      return (
        <StateCard tone="warn" icon={Hourglass} title={`تجربتك تنتهي ${inTime(stage.freezeAt, now)}`} compact>
          <p>
            {when(stage.freezeAt)}. بعدها يُجمَّد المتجر فلا يراه العملاء ولا يستقبل طلبات
            {del ? `، ثم يُحذف نهائياً ${when(del)} إن لم تدفع` : ""}.
          </p>
        </StateCard>
      );
    }
    if (stage.phase === "expired") {
      return (
        <StateCard tone="bad" icon={Clock} title="انتهت تجربتك المجانية" compact>
          <p>متجرك يُجمَّد الآن. ادفع ويعود كما هو بمنتجاته وطلباته فور قبول الإيصال{del ? `، وإلا يُحذف نهائياً ${when(del)}` : ""}.</p>
        </StateCard>
      );
    }
    if (stage.phase === "frozen") {
      return (
        <StateCard tone="bad" icon={Snowflake} title="متجرك مجمّد" compact>
          <p>
            لا يراه العملاء ولا يستقبل طلبات، وكل بياناته محفوظة{del ? ` حتى ${when(del)} (${inTime(del, now)})، ثم يُحذف نهائياً` : ""}. ادفع
            ويعود كما هو فور قبول الإيصال.
          </p>
        </StateCard>
      );
    }
    return (
      <StateCard tone="bad" icon={AlertTriangle} title={del ? `متجرك محفوظ حتى ${when(del)}` : "أرسل إيصالاً صحيحاً"} compact>
        <p>{del ? `${inTime(del, now)} يُحذف المتجر نهائياً إن لم يصلنا إيصال صحيح.` : "متجرك ينتظر إيصالاً صحيحاً ليُفعَّل."}</p>
      </StateCard>
    );
  })();

  return (
    <div className="space-y-3">
      {rejected}
      {box}
    </div>
  );
}

function Offer({ price, basePrice }: { price: number; basePrice: number }) {
  const off = basePrice > price ? Math.round((1 - price / basePrice) * 100) : 0;
  return (
    <aside aria-label="ما تدفع مقابله" className="dash-card p-5 lg:sticky lg:top-20">
      <p className="text-[12px] font-bold text-ink-3">تدفع مرة واحدة</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="text-4xl font-black tabular-nums text-ink">{fmtNum(price)}</span>
        <span className="text-[14px] font-bold text-ink-2">ج.م</span>
        {off ? (
          <>
            <s className="text-[13px] tabular-nums text-ink-3">{fmtNum(basePrice)} ج.م</s>
            <span className="rounded-md bg-ok/10 px-1.5 py-0.5 text-[11px] font-black text-ok">خصم {fmtNum(off)}%</span>
          </>
        ) : null}
      </div>
      <ul className="mt-4 space-y-2.5 text-[12.5px] leading-6 text-ink-2">
        {[
          "متجرك ولوحة تحكمه بكل منتجاتك وطلباتك وعملائك، ينتقلون لحساباتك أنت بخطوات مشروحة: GitHub، Vercel، Neon.",
          "بلا اشتراك ولا عمولة لنا على أي طلب، ولا مفاتيحك عندنا.",
          "تحديث متجرك لآخر إصدار بزر واحد متى شئت.",
          "مساعد ذكي في لوحتك يعمل بمفتاح Groq المجاني الخاص بك.",
          "الشكل نفسه الذي تراه الآن، لا يتغير بعد الدفع.",
        ].map((t) => (
          <li key={t} className="flex gap-2">
            <Check className="mt-1 size-4 shrink-0 text-ok" aria-hidden="true" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-edge/10 pt-3 text-[11.5px] leading-5 text-ink-3">
        الخطط المجانية لهذه الخدمات تكفي متجراً في بدايته؛ لو تجاوزها متجرك تدفع لهم مباشرة، لا لنا.
      </p>
    </aside>
  );
}

function InReview({ payment }: { payment: BillingPayment }) {
  const steps = [
    { done: true, title: "وصل إيصالك", text: `${formatEgp(payment.amountPiasters)} عبر ${METHOD[payment.method] ?? payment.method}، ${shortFmt.format(payment.createdAt)}` },
    { done: false, current: true, title: "نراجع الإيصال بأنفسنا", text: "نطابق المبلغ والرقم المحوَّل منه مع ما وصلنا. لا يُجمَّد متجرك ولا يُحذف أثناء ذلك." },
    { done: false, title: "يُفعَّل متجرك ويصلك بريد", text: "وتتحدث هذه الصفحة وحدها." },
    { done: false, title: "تستلم متجرك على حساباتك", text: "من «امتلك متجرك» بخطوات مشروحة." },
  ];
  return (
    <section aria-labelledby="review-title" className="dash-card grid gap-5 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <h2 id="review-title" className="flex items-center gap-2 text-[16px] font-black text-ink">
          <Clock className="size-5 text-nova-2" aria-hidden="true" /> إيصالك قيد المراجعة
        </h2>
        <ol className="mt-4 space-y-0">
          {steps.map((s, i) => (
            <li key={s.title} className="relative flex gap-3 pb-5 last:pb-0">
              {i < steps.length - 1 ? <span aria-hidden="true" className={cn("absolute top-7 bottom-0 start-[13px] w-px", s.done ? "bg-ok/50" : "bg-edge/15")} /> : null}
              <span
                className={cn(
                  "relative grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-black",
                  s.done ? "bg-ok text-white" : s.current ? "bg-nova/15 text-nova-2 ring-2 ring-nova/40" : "bg-edge/[0.06] text-ink-3"
                )}
                aria-hidden="true"
              >
                {s.done ? <Check className="size-4" /> : s.current ? <span className="size-2 animate-pulse rounded-full bg-nova-2" /> : i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className={cn("text-[13px] font-black", s.done || s.current ? "text-ink" : "text-ink-3")}>
                  {s.title}
                  {s.current ? <span className="sr-only"> (الخطوة الحالية)</span> : null}
                </p>
                <p className="mt-0.5 text-[12px] leading-5 text-ink-3">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      {payment.screenshotUrl ? (
        <a href={payment.screenshotUrl} target="_blank" rel="noopener noreferrer" className="group block w-full max-w-[11rem] justify-self-center md:justify-self-end">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={payment.screenshotUrl} alt="صورة الإيصال الذي أرسلته" className="h-56 w-full rounded-xl border border-edge/10 bg-edge/5 object-cover object-top" />
          <span className="mt-1.5 flex items-center justify-center gap-1 text-[11.5px] font-bold text-ink-3 group-hover:text-ink">
            الإيصال المرسَل <ExternalLink className="size-3" aria-hidden="true" />
          </span>
        </a>
      ) : null}
    </section>
  );
}

function Activated({ activatedAt, payment, window: w, now }: { activatedAt: Date | null; payment: BillingPayment | null; window: OwnWindow; now: number }) {
  const due =
    w.phase === "open"
      ? ` انقله قبل ${when(w.deadline)} (${inTime(w.deadline, now)})، وبعدها يتوقف المتجر عن استقبال الطلبات حتى تكمل النقل.`
      : w.phase === "overdue"
        ? ` انتهت مهلة النقل فتوقف المتجر عن استقبال الطلبات؛ أكمل النقل قبل ${when(w.purgeAt)} وإلا تُحذف بياناته من Colapia.`
        : "";
  return (
    <StateCard
      tone={w.phase === "overdue" ? "bad" : "ok"}
      icon={PartyPopper}
      title="متجرك مفعّل"
      text={`${activatedAt ? `فُعِّل ${when(activatedAt)}` : "دفعتك مؤكدة"}${payment ? ` بدفعة ${formatEgp(payment.amountPiasters)}` : ""}. الخطوة الباقية: استلم متجرك وبياناته على حساباتك أنت.${due}`}
    >
      <CtaLink href="/dashboard/own">امتلك متجرك الآن</CtaLink>
    </StateCard>
  );
}

function Unavailable({ reason }: { reason: "building" | "suspended" | "deleted" }) {
  if (reason === "building")
    return (
      <StateCard tone="muted" icon={Lock} title="الدفع بعد أن تجرّب متجرك" text="متجرك لم يُسلَّم لك بعد. حين يصبح جاهزاً تبدأ تجربتك المجانية، وتدفع فقط إن أعجبك.">
        <CtaLink href="/dashboard">ارجع للوحة</CtaLink>
      </StateCard>
    );
  return (
    <StateCard
      tone="bad"
      icon={AlertTriangle}
      title={reason === "suspended" ? "متجرك موقوف" : "متجرك حُذف"}
      text={reason === "suspended" ? "أوقفت المنصة هذا المتجر، فلا يُقبل عليه دفع الآن." : "انتهت مهلة هذا المتجر وحُذف. يمكنك بناء متجر جديد في أي وقت."}
    />
  );
}

const TONE = {
  ok: { box: "border-ok/25 bg-ok/[0.05]", icon: "bg-ok/15 text-ok" },
  warn: { box: "border-warn/30 bg-warn/[0.06]", icon: "bg-warn/15 text-warn" },
  bad: { box: "border-bad/30 bg-bad/[0.06]", icon: "bg-bad/15 text-bad" },
  muted: { box: "border-edge/10 bg-edge/[0.02]", icon: "bg-edge/[0.06] text-ink-3" },
} as const;

function StateCard({
  tone,
  icon: Icon,
  title,
  text,
  compact,
  children,
}: {
  tone: keyof typeof TONE;
  icon: typeof Clock;
  title: string;
  text?: string;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const t = TONE[tone];
  return (
    <section className={cn("flex items-start gap-3 rounded-2xl border", t.box, compact ? "p-4" : "p-5 sm:p-6")}>
      <span className={cn("grid shrink-0 place-items-center rounded-xl", t.icon, compact ? "size-9" : "size-11")} aria-hidden="true">
        <Icon className={compact ? "size-4.5" : "size-5"} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className={cn("font-black text-ink", compact ? "text-[14px]" : "text-[16px]")}>{title}</h2>
        {text ? <p className="mt-1 text-[12.5px] leading-6 text-ink-2">{text}</p> : null}
        {compact && children ? <div className="mt-1 text-[12.5px] leading-6 text-ink-2">{children}</div> : children}
      </div>
    </section>
  );
}

function CtaLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[13px] font-black text-white shadow-md hover:shadow-lg">
      {children}
      <ArrowLeft className="size-4" aria-hidden="true" />
    </Link>
  );
}

const STATUS: Record<BillingPayment["status"], { label: string; cls: string; icon: typeof Clock }> = {
  under_review: { label: "قيد المراجعة", cls: "bg-warn/10 text-warn", icon: Clock },
  confirmed: { label: "مقبول", cls: "bg-ok/10 text-ok", icon: CheckCircle2 },
  rejected: { label: "مرفوض", cls: "bg-bad/10 text-bad", icon: XCircle },
  refunded: { label: "مُسترد", cls: "bg-edge/[0.06] text-ink-3", icon: Receipt },
  pending: { label: "لم يكتمل", cls: "bg-edge/[0.06] text-ink-3", icon: Clock },
};

function History({ payments }: { payments: BillingPayment[] }) {
  return (
    <section aria-labelledby="history-title" className="dash-card p-5">
      <h2 id="history-title" className="text-[14px] font-black text-ink">
        إيصالاتك
      </h2>
      <ul className="mt-3 divide-y divide-edge/10">
        {payments.map((p) => {
          const s = STATUS[p.status];
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", s.cls)} aria-hidden="true">
                <s.icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1 basis-40">
                <p className="text-[13px] font-bold text-ink">
                  {formatEgp(p.amountPiasters)} · {METHOD[p.method] ?? p.method}
                </p>
                <p className="text-[11.5px] text-ink-3">
                  {shortFmt.format(p.createdAt)}
                  {p.senderPhone ? (
                    <>
                      {" · من "}
                      <bdi className="whitespace-nowrap font-mono">{prettyPhone(p.senderPhone)}</bdi>
                    </>
                  ) : null}
                </p>
                {p.status === "rejected" && p.reviewNote ? <p className="mt-0.5 text-[11.5px] text-bad">{p.reviewNote}</p> : null}
              </div>
              <span className={cn("rounded-lg px-2 py-1 text-[11.5px] font-black", s.cls)}>{s.label}</span>
              {p.screenshotUrl ? (
                <a href={p.screenshotUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[11.5px] font-bold text-ink-3 hover:bg-edge/5 hover:text-ink">
                  الإيصال <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
