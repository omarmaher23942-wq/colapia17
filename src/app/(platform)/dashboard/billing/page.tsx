// dashboard/billing — الاشتراك (V3، D2): الباقة الشهرية وعدّادات حدودها، والدفع والتجديد، وسجل الإيصالات. على المنصة فقط.
// الصفحة تعرض مرحلة التاجر كما هي (lib/billing-stage.ts):
//  - الدفع: التجربة الجارية بموعد التجميد والحذف، أو انتهاؤها، أو التجميد (اللوحة مقفلة إلا هنا)، أو رفض إيصال سابق بسببه؛
//    ثم نموذج الدفع (التجهيز + الباقة × الأشهر، وكود الدائرة الذهبية).
//  - قيد المراجعة: الإيصال المرسَل وخطوات ما بعده. تتحدث تلقائياً عند القبول.
//  - مفعّل: حالة الاشتراك (سارٍ، يقترب، سماح، متوقف) وتاريخ انتهائه، والتجديد (الباقة × الأشهر) حين يُفتح.
// الأسعار من currentPricing (نفس الهبوط والتحقق من الإيصال)، وأرقام التحويل من متغيرات المنصة.
import Link from "next/link";
import { requireStoreArea } from "@/server/merchant-guard";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { AlertTriangle, ArrowLeft, CalendarCheck, Check, CheckCircle2, Clock, ExternalLink, Hourglass, Lock, PauseCircle, Receipt, RefreshCw, Snowflake, XCircle } from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { db } from "@/db/client";
import { platformPayments, storeRequests } from "@/db/schema";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/format";
import { formatEgp } from "@/lib/money";
import { prettyPhone } from "@/lib/phone";
import { trialFacts, type TrialFacts } from "@/server/repos/trial-facts";
import { currentPricing, goldenStatus } from "@/server/pricing";
import { usageSummary } from "@/server/usage";
import { limitHighlights, monthsLabel, planById, planIdFrom, type PricingModel } from "@/lib/platform-pricing";
import { hostingGraceDays } from "@/server/hosting-grace";
import { billingStage, type BillingPayment, type BillingStage } from "@/lib/billing-stage";
import { canRenewNow, RENEW_OPEN_DAYS, type HostingState } from "@/lib/hosting";
import { PayForm, type PayPlan } from "@/components/dashboard/billing/PayForm";
import { UsageGrid } from "@/components/dashboard/usage/UsageMeters";
import { AutoRefresh } from "@/components/platform/AutoRefresh";

export const dynamic = "force-dynamic";
export const metadata = { title: "الاشتراك" };

const METHOD: Record<string, string> = { vodafone_cash: "فودافون كاش", instapay: "إنستاباي", cod: "نقداً" };

const dateFmt = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" });
const shortFmt = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" });
const dayFmt = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Cairo" });
const when = (d: Date) => dateFmt.format(d);

type Payment = BillingPayment & { tier: string | null; months: number | null; plan: string };

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

const payPlans = (m: PricingModel): PayPlan[] => m.plans.map((p) => ({ id: p.id, name: p.name, monthly: p.monthly, highlights: limitHighlights(p.limits) }));

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ locked?: string }> }) {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/billing");
  if (!session.store) redirect("/no-store");
  await requireStoreArea("billing");
  const store = session.store;
  const { locked } = await searchParams;

  const payments = (await db
    .select({
      id: platformPayments.id,
      kind: platformPayments.kind,
      coversUntil: platformPayments.coversUntil,
      status: platformPayments.status,
      method: platformPayments.method,
      amountPiasters: platformPayments.amountPiasters,
      senderPhone: platformPayments.senderPhone,
      screenshotUrl: platformPayments.screenshotUrl,
      reviewNote: platformPayments.reviewNote,
      reviewedAt: platformPayments.reviewedAt,
      createdAt: platformPayments.createdAt,
      tier: platformPayments.tier,
      months: platformPayments.months,
      plan: platformPayments.plan,
    })
    .from(platformPayments)
    .where(eq(platformPayments.storeId, store.id))
    .orderBy(desc(platformPayments.createdAt))
    .limit(30)) as Payment[];

  const now = Date.now();
  const grace = await hostingGraceDays().catch(() => 3);
  const stage = billingStage(store, payments, new Date(now), grace);
  const [current, goldenNow, usage] = await Promise.all([currentPricing(), goldenStatus(store.id), usageSummary(store.id).catch(() => null)]);
  // تاجر جاء من دعوة «الدائرة الذهبية»: خانة الكود تظهر مملوءة بكود العرض.
  const [req] = await db
    .select({ data: storeRequests.data })
    .from(storeRequests)
    .where(eq(storeRequests.storeId, store.id))
    .limit(1)
    .catch(() => []);
  const suggestCoupon = (req?.data as { offer?: string } | null)?.offer === "golden" && goldenNow.available ? goldenNow.code : undefined;
  const golden = goldenNow.available ? { code: goldenNow.code, buildPrice: goldenNow.buildPrice, regularBuildPrice: goldenNow.regularBuildPrice, seatsLeft: goldenNow.seatsLeft } : null;
  const currentPlanId = store.status === "active" ? planIdFrom(store.plan) ?? "growth" : null;
  const currentPlan = currentPlanId ? planById(current, currentPlanId) : null;

  const renewing = stage.kind === "active" && Boolean(stage.renewalPending);
  const facts = stage.kind === "pay" ? await trialFacts(store).catch(() => null) : null;
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {stage.kind === "review" || renewing ? <AutoRefresh everyMs={15000} /> : null}
      <header>
        <h1 className="text-xl font-black text-ink">الاشتراك</h1>
        <p className="mt-1 text-[12.5px] leading-6 text-ink-3">
          {currentPlan ? `متجر ${store.name} على باقة «${currentPlan.name}» (${fmtNum(currentPlan.monthly)} ج.م شهرياً). ` : `متجر ${store.name}: `}
          تجهيز المتجر مرة واحدة، ثم استضافة شهرية بالباقة المناسبة. بلا عمولة على مبيعاتكم.
        </p>
      </header>

      {locked && (stage.kind === "pay" || (stage.kind === "active" && stage.hosting.phase === "paused")) ? (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-bad/30 bg-bad/[0.06] p-4 text-[12.5px] leading-6">
          <Lock className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden="true" />
          <p className="text-ink-2">
            <b className="text-ink">لوحة التحكم مقفلة حتى يتم الدفع. </b>
            كل المنتجات والطلبات والإعدادات محفوظة كما هي، وتعود اللوحة والمتجر كما كانا فور قبول الإيصال.
          </p>
        </div>
      ) : null}

      {stage.kind === "pay" ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <div className="space-y-4">
            <PhaseBanner stage={stage} now={now} />
            {facts ? <SoFar facts={facts} /> : null}
            <PayForm model={current} plans={payPlans(current)} kind="setup" vodafone={env.VODAFONE_CASH_NUMBER} instapay={env.INSTAPAY_NUMBER} golden={golden} suggestCoupon={suggestCoupon} />
          </div>
          <Offer pricing={current} />
        </div>
      ) : null}

      {stage.kind === "review" ? <InReview payment={stage.payment} /> : null}
      {stage.kind === "active" ? (
        <Hosting stage={stage} pricing={current} currentPlanId={currentPlanId} grace={grace} now={now} vodafone={env.VODAFONE_CASH_NUMBER} instapay={env.INSTAPAY_NUMBER} />
      ) : null}
      {stage.kind === "unavailable" ? <Unavailable reason={stage.reason} /> : null}

      {usage && stage.kind !== "unavailable" ? (
        <section aria-labelledby="usage-h" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="usage-h" className="text-[15px] font-black text-ink">
              {usage.isTrial ? `الاستخدام (التجربة بحدود باقة «${usage.planName}»)` : `الاستخدام في باقة «${usage.planName}»`}
            </h2>
            <Link href="/dashboard/usage" className="text-[12px] font-bold text-nova-2 underline-offset-4 hover:underline">
              التفاصيل
            </Link>
          </div>
          <UsageGrid u={usage} />
        </section>
      ) : null}

      {payments.length ? <History payments={payments} pricing={current} /> : null}
    </div>
  );
}

/** ما في المتجر الآن ويبقى كما هو بالتفعيل: أرقام حقيقية فقط، وما لم يحدث لا يُذكر. */
function SoFar({ facts }: { facts: TrialFacts }) {
  const items = [
    { n: facts.products, label: "منتج منشور" },
    facts.visitors > 0 ? { n: facts.visitors, label: "زائر منذ التسليم" } : null,
    facts.realOrders > 0 ? { n: facts.realOrders, label: "طلب حقيقي" } : null,
    facts.orders > 0 ? { n: facts.orders, label: "طلب تجريبي" } : null,
  ].filter((x): x is { n: number; label: string } => x !== null);
  return (
    <section className="dash-card p-4" aria-label="المتجر حتى الآن">
      <p className="text-[13px] font-black text-ink">كل هذا يبقى كما هو بالتفعيل</p>
      <ul className={`mt-2.5 grid gap-2 ${items.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
        {items.map((x) => (
          <li key={x.label} className="rounded-xl bg-edge/[0.04] p-2.5">
            <p className="text-lg font-black tabular-nums text-ink">{fmtNum(x.n)}</p>
            <p className="text-[11.5px] text-ink-3">{x.label}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[11.5px] leading-5 text-ink-3">نفس الرابط والتصميم والمنتجات والإعدادات، والطلبات الحقيقية تستمر دون توقف إن تم الدفع قبل انتهاء التجربة.</p>
    </section>
  );
}

function PhaseBanner({ stage, now }: { stage: Extract<BillingStage, { kind: "pay" }>; now: number }) {
  const del = stage.deleteAt;
  const rejected = stage.rejected ? (
    <div className="flex items-start gap-3 rounded-2xl border border-bad/30 bg-bad/[0.06] p-4">
      <XCircle className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden="true" />
      <div className="min-w-0 text-[12.5px] leading-6">
        <p className="font-black text-ink">لم نقبل الإيصال السابق</p>
        <p className="text-ink-2">{stage.rejected.reviewNote?.trim() || "لم نتمكن من التأكد من وصول التحويل."}</p>
        <p className="text-ink-3">إن تم التحويل فعلاً، المطلوب صورة أوضح يظهر فيها المبلغ والتاريخ ورقم العملية.</p>
      </div>
    </div>
  ) : null;

  const box = (() => {
    if (stage.phase === "trial" && stage.freezeAt) {
      return (
        <StateCard tone="warn" icon={Hourglass} title={`التجربة تنتهي ${inTime(stage.freezeAt, now)}`} compact>
          <p>
            {when(stage.freezeAt)}. بعدها يتجمد المتجر عن الزوار وتُقفل لوحة التحكم إلا هذه الصفحة
            {del ? `، ثم يُحذف نهائياً ${when(del)} إن لم يتم الدفع` : ""}. الدفع الآن يُبقي المتجر يعمل دون أي توقف.
          </p>
        </StateCard>
      );
    }
    if (stage.phase === "expired") {
      return (
        <StateCard tone="bad" icon={Clock} title="انتهت التجربة المجانية" compact>
          <p>يتجمد المتجر الآن. بالدفع يعود كما هو بمنتجاته وطلباته ولوحته فور قبول الإيصال{del ? `، وإلا يُحذف نهائياً ${when(del)}` : ""}.</p>
        </StateCard>
      );
    }
    if (stage.phase === "frozen") {
      return (
        <StateCard tone="bad" icon={Snowflake} title="المتجر مجمّد" compact>
          <p>
            لا يراه العملاء ولا يستقبل طلبات، واللوحة مقفلة إلا هذه الصفحة، وكل البيانات محفوظة{del ? ` حتى ${when(del)} (${inTime(del, now)})، ثم يُحذف نهائياً` : ""}. بالدفع
            يعود كل شيء كما كان فور قبول الإيصال.
          </p>
        </StateCard>
      );
    }
    return (
      <StateCard tone="bad" icon={AlertTriangle} title={del ? `المتجر محفوظ حتى ${when(del)}` : "المطلوب إيصال صحيح"} compact>
        <p>{del ? `${inTime(del, now)} يُحذف المتجر نهائياً إن لم يصلنا إيصال صحيح.` : "المتجر ينتظر إيصالاً صحيحاً ليُفعَّل."}</p>
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

function Offer({ pricing }: { pricing: PricingModel }) {
  return (
    <aside aria-label="ما يشمله الاشتراك" className="dash-card p-5 lg:sticky lg:top-20">
      <p className="text-[12px] font-bold text-ink-3">ما يشمله الاشتراك</p>
      <ul className="mt-3 space-y-2.5 text-[12.5px] leading-6 text-ink-2">
        {[
          `تجهيز المتجر ${fmtNum(pricing.build.price)} ج.م مرة واحدة، ولا يتكرر في التجديد.`,
          "المتجر بتصميمه الحالي ولوحة تحكمه، مفتوح لعملائكم على رابطه نفسه.",
          `استضافة وتشغيل وتحديثات ودعم شهرياً بحدود الباقة، والدفع لمدة ${pricing.months.map(monthsLabel).join(" أو ")}.`,
          "الطلبات والزوار بلا حد، وبلا عمولة لنا على أي طلب.",
          "المتجر المدفوع لا يُحذف بسبب التأخر في التجديد: يتوقف عن الظهور فقط ويعود فور التجديد.",
          "يمكن تغيير الباقة عند أي تجديد.",
        ].map((t) => (
          <li key={t} className="flex gap-2">
            <Check className="mt-1 size-4 shrink-0 text-ok" aria-hidden="true" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function InReview({ payment, renewal }: { payment: BillingPayment; renewal?: boolean }) {
  const steps = renewal
    ? [
        { done: true, title: "وصل إيصال التجديد", text: `${formatEgp(payment.amountPiasters)} عبر ${METHOD[payment.method] ?? payment.method}، ${shortFmt.format(payment.createdAt)}` },
        { done: false, current: true, title: "نراجع الإيصال بأنفسنا", text: "لا يتوقف المتجر أثناء المراجعة إن كان يعمل الآن." },
        { done: false, title: "تُمد الاستضافة بالمدة المختارة ويصلكم بريد", text: "وتتحدث هذه الصفحة وحدها." },
      ]
    : [
        { done: true, title: "وصل الإيصال", text: `${formatEgp(payment.amountPiasters)} عبر ${METHOD[payment.method] ?? payment.method}، ${shortFmt.format(payment.createdAt)}` },
        { done: false, current: true, title: "نراجع الإيصال بأنفسنا", text: "نطابق المبلغ والرقم المحوَّل منه مع ما وصلنا. لا يتجمد المتجر ولا يُحذف أثناء ذلك." },
        { done: false, title: "يُفعَّل المتجر ويصلكم بريد", text: "وتتحدث هذه الصفحة وحدها." },
        { done: false, title: "المتجر مفتوح لعملائكم", text: "بالباقة والمدة المختارتين، وتبدأ من يوم القبول." },
      ];
  return (
    <section aria-labelledby="review-title" className="dash-card grid gap-5 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <h2 id="review-title" className="flex items-center gap-2 text-[16px] font-black text-ink">
          <Clock className="size-5 text-nova-2" aria-hidden="true" /> {renewal ? "إيصال التجديد قيد المراجعة" : "الإيصال قيد المراجعة"}
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
          <img src={payment.screenshotUrl} alt="صورة الإيصال المرسَل" className="h-56 w-full rounded-xl border border-edge/10 bg-edge/5 object-cover object-top" />
          <span className="mt-1.5 flex items-center justify-center gap-1 text-[11.5px] font-bold text-ink-3 group-hover:text-ink">
            الإيصال المرسَل <ExternalLink className="size-3" aria-hidden="true" />
          </span>
        </a>
      ) : null}
    </section>
  );
}

function Hosting({
  stage,
  pricing,
  currentPlanId,
  grace,
  now,
  vodafone,
  instapay,
}: {
  stage: Extract<BillingStage, { kind: "active" }>;
  pricing: PricingModel;
  currentPlanId: ReturnType<typeof planIdFrom>;
  grace: number;
  now: number;
  vodafone: string;
  instapay: string;
}) {
  const h = stage.hosting;
  const card = hostingCard(h, now);
  const open = canRenewNow(h) && !stage.renewalPending;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      <div className="space-y-4">
        <StateCard tone={card.tone} icon={card.icon} title={card.title} text={card.text} />
        {stage.renewalPending ? <InReview payment={stage.renewalPending} renewal /> : null}
        {stage.renewalRejected && !stage.renewalPending ? (
          <div className="flex items-start gap-3 rounded-2xl border border-bad/30 bg-bad/[0.06] p-4">
            <XCircle className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden="true" />
            <div className="min-w-0 text-[12.5px] leading-6">
              <p className="font-black text-ink">لم نقبل إيصال التجديد السابق</p>
              <p className="text-ink-2">{stage.renewalRejected.reviewNote?.trim() || "لم نتمكن من التأكد من وصول التحويل."}</p>
            </div>
          </div>
        ) : null}
        {open ? <PayForm model={pricing} plans={payPlans(pricing)} kind="renewal" currentPlan={currentPlanId} vodafone={vodafone} instapay={instapay} /> : null}
      </div>
      <aside aria-label="أسعار التجديد" className="dash-card p-5 lg:sticky lg:top-20">
        <p className="text-[12px] font-bold text-ink-3">التجديد (الباقة فقط، بلا رسوم تجهيز)</p>
        <ul className="mt-2 space-y-1.5">
          {pricing.plans.map((p) => (
            <li key={p.id} className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-bold text-ink-2">
                {p.name}
                {p.id === currentPlanId ? <span className="ms-1 text-[11px] text-ok">(الحالية)</span> : null}
              </span>
              <span className="text-[18px] font-black tabular-nums text-ink">
                {fmtNum(p.monthly)} <span className="text-[11.5px] font-bold text-ink-2">ج.م شهرياً</span>
              </span>
            </li>
          ))}
        </ul>
        <ul className="mt-4 space-y-2.5 text-[12.5px] leading-6 text-ink-2">
          {[
            `يُفتح التجديد قبل انتهاء الاشتراك بـ ${fmtNum(RENEW_OPEN_DAYS)} يوماً، والمدة الجديدة تُضاف لنهاية الحالية فلا يضيع يوم.`,
            `بعد الانتهاء يبقى المتجر يعمل ${fmtNum(grace)} ${grace === 1 ? "يوماً" : grace === 2 ? "يومين" : grace <= 10 ? "أيام" : "يوماً"}، ثم يتوقف عن الظهور للزوار وتُقفل اللوحة إلا هذه الصفحة حتى التجديد.`,
            "لا يُحذف شيء من البيانات بسبب التأخر في التجديد.",
            "نذكّركم قبل الانتهاء بشهر وأسبوع ويوم.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <Check className="mt-1 size-4 shrink-0 text-ok" aria-hidden="true" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        {stage.activatedAt ? <p className="mt-4 border-t border-edge/10 pt-3 text-[11.5px] text-ink-3">مفعّل منذ {when(stage.activatedAt)}.</p> : null}
      </aside>
    </div>
  );
}

function hostingCard(h: HostingState, now: number): { tone: keyof typeof TONE; icon: typeof Clock; title: string; text: string } {
  switch (h.phase) {
    case "active":
      return { tone: "ok", icon: CalendarCheck, title: "المتجر مفعّل والاشتراك سارٍ", text: `حتى ${dayFmt.format(h.expiresAt)} (${inTime(h.expiresAt, now)}). لا شيء مطلوب الآن.` };
    case "renew_soon":
      return { tone: "warn", icon: RefreshCw, title: `الاشتراك ينتهي ${inTime(h.expiresAt, now)}`, text: `في ${dayFmt.format(h.expiresAt)}. بالتجديد الآن تُضاف المدة الجديدة بعد هذا التاريخ.` };
    case "grace":
      return { tone: "bad", icon: AlertTriangle, title: "انتهت مدة الاشتراك", text: `المتجر ما زال يعمل حتى ${dayFmt.format(h.pauseAt)} (${inTime(h.pauseAt, now)})، ثم يتوقف عن الظهور للزوار حتى التجديد. البيانات محفوظة كاملة.` };
    case "paused":
      return { tone: "bad", icon: PauseCircle, title: "المتجر متوقف مؤقتاً", text: "لا يراه الزوار الآن لانتهاء الاشتراك، واللوحة مقفلة إلا هذه الصفحة. لم يُحذف أي شيء: بالتجديد يعود كل شيء فوراً بنفس الرابط ونفس البيانات." };
    default:
      return { tone: "ok", icon: CheckCircle2, title: "المتجر مفعّل", text: "الدفعة مؤكدة." };
  }
}

function Unavailable({ reason }: { reason: "building" | "suspended" | "deleted" }) {
  if (reason === "building")
    return (
      <StateCard tone="muted" icon={Lock} title="الدفع بعد تجربة المتجر" text="المتجر لم يكتمل إعداده بعد. حين يصبح جاهزاً تبدأ التجربة المجانية، والدفع فقط إن أعجبكم.">
        <CtaLink href="/dashboard">العودة للوحة</CtaLink>
      </StateCard>
    );
  return (
    <StateCard
      tone="bad"
      icon={AlertTriangle}
      title={reason === "suspended" ? "المتجر موقوف" : "المتجر حُذف"}
      text={reason === "suspended" ? "أوقفت المنصة هذا المتجر، فلا يُقبل عليه دفع الآن." : "انتهت مهلة هذا المتجر وحُذف. يسعدنا تجهيز متجر جديد في أي وقت."}
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

/** سجل الفواتير (الإيصالات) بنوعها وباقتها ومدتها وما غطته. */
function History({ payments, pricing }: { payments: Payment[]; pricing: PricingModel }) {
  return (
    <section aria-labelledby="history-title" className="dash-card p-5">
      <h2 id="history-title" className="text-[14px] font-black text-ink">
        سجل الدفعات
      </h2>
      <ul className="mt-3 divide-y divide-edge/10">
        {payments.map((p) => {
          const s = STATUS[p.status];
          const plan = planById(pricing, p.tier);
          const what = [
            p.kind === "renewal" ? "تجديد" : p.plan === "golden" ? "دفعة أولى (الدائرة الذهبية)" : "دفعة أولى",
            plan ? `باقة ${plan.name}` : null,
            p.months ? monthsLabel(p.months) : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", s.cls)} aria-hidden="true">
                <s.icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1 basis-40">
                <p className="text-[13px] font-bold text-ink">
                  {what} · {formatEgp(p.amountPiasters)}
                </p>
                {p.status === "confirmed" && p.coversUntil ? <p className="text-[11.5px] text-ok">الاشتراك حتى {dayFmt.format(p.coversUntil)}</p> : null}
                <p className="text-[11.5px] text-ink-3">
                  {shortFmt.format(p.createdAt)} · {METHOD[p.method] ?? p.method}
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
