// Landing V2 — صفحة Colapia الرئيسية. تُرسم على الخادم بالكامل (سرعة وظهور في البحث)، والتفاعل في جزر صغيرة.
// كل جملة هنا صحيحة عن الخدمة اليوم: فريق Colapia يجهّز المتجر، بلا ذكر لأدوات الذكاء الاصطناعي ولا لتقنيات التشغيل.
// النص قليل عمداً: عنوان وسطر لكل فكرة، واللقطات الحقيقية تقوم بالباقي.
import Link from "next/link";
import Image from "next/image";
import {
  Check,
  ArrowLeft,
  Instagram,
  MessageCircle,
  Sparkles,
  Rocket,
  ChevronDown,
  Camera,
  ShieldCheck,
  Megaphone,
  Ruler,
  BellRing,
  Globe,
  Smartphone,
  LayoutDashboard,
  Store,
  PackageCheck,
  BadgePercent,
  Timer,
  Server,
  Hourglass,
} from "lucide-react";
import { CosmicBackdrop } from "./CosmicBackdrop";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { TestimonialsSection } from "./TestimonialsSection";
import { StoreMorph } from "./StoreMorph";
import { ThemesShowcase } from "./ThemesShowcase";
import { MINI_STORES, StoreMini } from "./StoreMini";
import { CTA_GHOST, CTA_PRIMARY, Eyebrow } from "./shared";
import { changesLabel, fmtPrice, type LandingOffer, type PlanCard } from "@/lib/landing-pricing";
import type { LandingReview, SessionState } from "./types";

type Props = {
  session: SessionState;
  reviews: LandingReview[];
  plans: PlanCard[];
  /** سطر رسوم التجهيز والمدد من الأسعار الحالية (lib/landing-pricing.ts buildFeeText). */
  buildFee?: string;
  offer?: LandingOffer;
  trialHours: number;
  graceDays: number;
  changesPerYear: number;
  igUrl: string;
  demoHref: string;
};

export function Landing({ session, reviews, plans, buildFee, offer, trialHours, graceDays, changesPerYear, igUrl, demoHref }: Props) {
  const merchant = session === "merchant";

  const Primary = () =>
    merchant ? (
      <Link href="/dashboard" className={CTA_PRIMARY}>
        <LayoutDashboard className="size-5" aria-hidden="true" /> لوحة التحكم
      </Link>
    ) : (
      <a href={igUrl} target="_blank" rel="noopener noreferrer" className={CTA_PRIMARY}>
        <Instagram className="size-5" aria-hidden="true" /> ابدأوا متجركم
      </a>
    );
  const Demo = ({ arrow }: { arrow?: boolean }) => (
    <a href={demoHref} target="_blank" rel="noopener noreferrer" className={CTA_GHOST}>
      شاهدوا متجراً تجريبياً {arrow ? <ArrowLeft className="size-4" aria-hidden="true" /> : null}
    </a>
  );

  return (
    <div dir="rtl" lang="ar" suppressHydrationWarning className="land relative min-h-dvh overflow-x-clip bg-[#07091a] text-[#eaf0ff]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-[#8fa8ff] focus:px-4 focus:py-2 focus:text-[#07091a]">
        تخطَّوا إلى المحتوى الرئيسي
      </a>
      <script
        dangerouslySetInnerHTML={{
          __html: `try{var t=localStorage.getItem("clp-land-theme");if(t==="light"||(!t&&matchMedia("(prefers-color-scheme: light)").matches))document.currentScript.parentElement.classList.add("land-light")}catch(e){}`,
        }}
      />
      <CosmicBackdrop />
      <Header session={session} igUrl={igUrl} />

      <main id="main-content">
        {/* ─── الواجهة ─── */}
        <section className="container-x grid items-center gap-10 pb-16 pt-6 sm:pt-12 lg:grid-cols-[1.1fr_1fr] lg:gap-8 lg:pb-24">
          <div className="land-rise flex flex-col items-start gap-6">
            <Eyebrow>للبراندات التي تبيع عبر إنستجرام</Eyebrow>
            <h1 className="text-[2.35rem] font-black leading-[1.12] tracking-tight sm:text-5xl lg:text-[3.7rem]">
              متجر احترافي كامل لبراندكم
              <br />
              <span className="land-gradient-text">مع لوحة تحكم تديرونه بها</span>
            </h1>
            <p className="max-w-lg text-base leading-8 text-[#c3cdf0]/85 sm:text-lg">
              يجهّزه فريق Colapia ويستضيفه ويشغّله، وتجرّبونه {trialHours} ساعة كاملة قبل أي دفع.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Primary />
              <Demo />
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-[#c3cdf0]/75">
              {["بلا عمولة على المبيعات", "استضافة وتشغيل مشمولان", "لوحة تحكم بالعربية"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-400" aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <StoreMorph />
        </section>

        {/* ─── حقائق ─── */}
        <section aria-label="باختصار" className="container-x">
          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 md:grid-cols-4">
            {[
              { icon: BadgePercent, big: "٠٪", small: "عمولة على المبيعات" },
              { icon: Server, big: "مشمولة", small: "الاستضافة والتشغيل طوال المدة" },
              { icon: Timer, big: `${fmtPrice(trialHours)} ساعة`, small: "تجربة قبل الدفع" },
              { icon: Hourglass, big: "يوم – ٤ أيام", small: "التجهيز كحد أقصى، وغالباً أسرع" },
            ].map(({ icon: Icon, big, small }) => (
              <li key={small} className="flex flex-col gap-1 bg-[#0a0e24] p-5 sm:p-6">
                <Icon className="size-5 text-[#8fa8ff]" aria-hidden="true" />
                <span className="mt-2 text-xl font-black sm:text-2xl">{big}</span>
                <span className="text-[13px] text-[#c3cdf0]/70">{small}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── كيف يعمل ─── */}
        <section id="how" className="container-x scroll-mt-24 py-24 sm:py-32">
          <Heading eyebrow="كيف يعمل" title="ثلاث خطوات، وتبدأون البيع" />
          <ol className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              { icon: MessageCircle, t: "محادثة قصيرة", d: "تراسلوننا على إنستجرام، ونجمع منكم بضع معلومات أساسية عن نشاطكم." },
              { icon: Sparkles, t: "إعداد ممتع لمتجركم", d: "نرسل لكم رابطاً تدخلون به بحساب Google، وتضيفون منتجاتكم وطرق الدفع والشحن بخطوات واضحة وسريعة." },
              { icon: Rocket, t: `متجركم جاهز، وتجربة ${fmtPrice(trialHours)} ساعة`, d: "تفتحون متجركم وتجرّبونه بطلبات حقيقية، ولا تدفعون إلا إن أعجبكم." },
            ].map(({ icon: Icon, t, d }, i) => (
              <li key={t} className="land-card relative flex flex-col gap-3 rounded-3xl p-6 sm:p-7">
                <span className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-2xl bg-[#6f86ff]/15 text-[#8fa8ff]">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-3xl font-black text-white/10">0{i + 1}</span>
                </span>
                <h3 className="text-lg font-black">{t}</h3>
                <p className="text-[14px] leading-7 text-[#c3cdf0]/75">{d}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-center text-[13px] text-[#c3cdf0]/65">يصلكم متجركم خلال يوم إلى 4 أيام عمل كحد أقصى، وغالباً أسرع.</p>
        </section>

        {/* ─── الديمو والهويات ─── */}
        <section id="designs" className="scroll-mt-24 border-y border-white/5 bg-gradient-to-b from-transparent via-[#0b1030]/60 to-transparent py-24 sm:py-32">
          <div className="container-x">
            <Heading eyebrow="تصميم واحد يناسب كل نشاط" title="شاهدوه يعمل بأنفسكم" subtitle="متجر تجريبي كامل بمنتجات وتقييمات حقيقية الشكل، تتصفحونه وتطلبون منه كأي زائر." />
            <div className="mt-8 flex justify-center">
              <Demo arrow />
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {MINI_STORES.map((s) => (
                <figure key={s.name} className="land-tilt">
                  <div className="aspect-[3/4] overflow-hidden rounded-[1.6rem] border border-white/10 shadow-2xl">
                    <StoreMini s={s} animate={false} />
                  </div>
                  <figcaption className="mt-3 flex items-center justify-between px-1 text-[13px]">
                    <span className="font-black">{s.name}</span>
                    <span className="text-[#8d97c4]">{s.kind}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="mt-6 text-center text-[12px] text-[#8d97c4]">نماذج توضيحية لاتجاهات مختلفة.</p>
          </div>
        </section>

        {/* ─── التصميمات الثمانية ─── */}
        <section id="themes" className="container-x scroll-mt-24 pb-24 sm:pb-32">
          <Heading eyebrow="ثمانية تصميمات كاملة" title="اختاروا هوية متجركم، وعدّلوا فيها ما تشاؤون" subtitle="كل تصميم له ألوانه وخطوطه وبطاقاته ووضعاه الفاتح والداكن، وتبدّلونه بضغطة وتكتبون ما تريدون تغييره بكلماتكم." />
          <ThemesShowcase />
        </section>

        {/* ─── لوحة التحكم ─── */}
        <section id="dashboard" className="container-x scroll-mt-24 py-24 sm:py-32">
          <Heading eyebrow="لوحة التحكم" title="كل متجركم في شاشة واحدة" subtitle="طلبات وعملاء ومخزون وتقارير، بالعربية، وتعمل من الموبايل كما من الكمبيوتر." />
          <div className="relative mx-auto mt-14 max-w-5xl">
            <div className="hidden overflow-hidden rounded-t-2xl border border-b-0 border-white/10 [mask-image:linear-gradient(to_bottom,#000_72%,transparent)] sm:block">
              <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/5 px-4 py-2.5" aria-hidden="true">
                <span className="size-2.5 rounded-full bg-white/20" />
                <span className="size-2.5 rounded-full bg-white/20" />
                <span className="size-2.5 rounded-full bg-white/20" />
              </div>
              <Image src="/landing/dash-dark.webp" alt="نظرة عامة على لوحة تحكم المتجر" width={1200} height={633} sizes="(min-width: 1024px) 1000px, 100vw" className="land-dark-only h-auto w-full" />
              <Image src="/landing/dash-light.webp" alt="نظرة عامة على لوحة تحكم المتجر" width={1200} height={633} sizes="(min-width: 1024px) 1000px, 100vw" className="land-light-only h-auto w-full" />
            </div>
            <div className="mx-auto w-[68%] max-w-[260px] overflow-hidden rounded-[1.6rem] border border-white/15 shadow-2xl sm:absolute sm:-bottom-10 sm:start-3 sm:mx-0 sm:w-[24%] sm:min-w-[150px] lg:-start-6">
              <Image src="/landing/orders-dark.webp" alt="قائمة الطلبات على الموبايل" width={375} height={745} sizes="220px" className="land-dark-only h-auto w-full" />
              <Image src="/landing/orders-light.webp" alt="قائمة الطلبات على الموبايل" width={375} height={745} sizes="220px" className="land-light-only h-auto w-full" />
            </div>
          </div>
        </section>

        {/* ─── المميزات (موجودة فعلاً) ─── */}
        <section id="features" className="container-x scroll-mt-24 pb-24 sm:pb-32">
          <Heading eyebrow="مبني لطريقة بيعكم" title="أدوات من واقع البيع على السوشيال" />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feature icon={Store} title="متجر جاهز للبيع" text="تصميم واحد متقن يتكيف مع نشاطكم ويعمل بوضعين فاتح وداكن." />
            <Feature icon={Camera} title="البحث بالصورة" text="يرفع الزائر لقطة من الريلز، فيصل للقطعة نفسها أو الأقرب لها." />
            <Feature icon={ShieldCheck} title="درع الدفع عند الاستلام" text="تأكيد من الزبون قبل الشحن، وتقدير لمخاطرة كل طلب، وعربون عند الحاجة." />
            <Feature icon={MessageCircle} title="الطلب على واتساب" text="رسالة جاهزة برقم الطلب وأصنافه والإجمالي، بضغطة واحدة." />
            <Feature icon={Megaphone} title="جاهز لإعلاناتكم" text="بكسل ميتا وتيك توك، وروابط حملات، وكتالوج لإعلانات ميتا." />
            <Feature icon={Ruler} title="مقاسات وألوان" text="لكل لون كميته وصورته، ودليل مقاسات يقترح المناسب." />
            <Feature icon={BellRing} title="نبّهوني عند التوفر" text="الزائر يسجّل رقمه للقطعة النافدة، وتبلغونه بضغطة." />
            <Feature icon={Globe} title="نطاقكم الخاص" text="اربطوا دومين براندكم من اللوحة، والشهادة الآمنة تلقائية." />
            <Feature icon={PackageCheck} title="تجهيز الشحن" text="قوائم تجهيز وتصدير لشركات الشحن وملصقات جاهزة للطباعة." />
            <Feature icon={Smartphone} title="سريع على الموبايل" text="مبني للموبايل أولاً، حيث يتصفح أغلب زبائنكم." />
          </div>
        </section>

        {/* ─── الباقات ─── */}
        <section id="pricing" className="container-x scroll-mt-24 pb-24 sm:pb-32">
          <Heading eyebrow="الباقات" title="اشتراك شهري واضح، وحدود معلنة من اليوم الأول" subtitle={buildFee ?? "تجهيز المتجر مرة واحدة، ثم الاستضافة الشهرية بالباقة المناسبة."} />
          {offer ? (
            <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-2">
              <div className="land-card rounded-3xl border border-white/10 p-6">
                <p className="text-sm font-bold text-[#c3cdf0]/80">تجهيز المتجر (مرة واحدة مع أول دفعة)</p>
                <p className="mt-2 flex items-end gap-2">
                  <span className="text-4xl font-black tabular-nums">{offer.buildText}</span>
                  <span className="mb-1 text-sm font-bold text-[#c3cdf0]/70">ج.م</span>
                </p>
                <p className="mt-2 text-[13px] leading-7 text-[#c3cdf0]/75">تصميم المتجر وإدخال البيانات والإعدادات والمراجعة قبل التسليم.</p>
              </div>
              {offer.golden ? (
                <div className="rounded-3xl border border-amber-300/35 bg-amber-300/[0.07] p-6">
                  <p className="text-sm font-black text-amber-300">الدائرة الذهبية · لأول {fmtPrice(offer.golden.seats)} براندات</p>
                  <p className="mt-2 flex items-end gap-2">
                    <span className="text-4xl font-black tabular-nums">{offer.golden.priceText}</span>
                    <span className="mb-1 text-sm font-bold text-[#c3cdf0]/70">ج.م للتجهيز</span>
                  </p>
                  <p className="mt-2 text-[13px] leading-7 text-[#c3cdf0]/80">
                    {offer.golden.firstMonthFree ? `ومعه الشهر الأول من الباقة الأساسية (${offer.golden.firstMonthText} ج.م) هدية. ` : ""}
                    المتبقي {fmtPrice(offer.golden.seatsLeft)} من {fmtPrice(offer.golden.seats)} مقاعد، ويُفعَّل بكود عرض يصلكم بدعوة.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-3">
            {plans.map((p) => (
              <article
                key={p.id}
                className={`relative flex flex-col rounded-[2rem] border p-7 ${
                  p.featured
                    ? "border-[#8fa8ff]/40 bg-gradient-to-b from-[#8fa8ff]/14 via-[#0e1430] to-[#0b1026] shadow-[0_40px_120px_-30px_rgba(111,134,255,0.45)]"
                    : "land-card border-white/10"
                }`}
              >
                {p.featured ? <span className="absolute -top-3 start-6 rounded-full bg-[#8fa8ff] px-3 py-1 text-[11px] font-black text-[#07091a]">الأكثر اختياراً</span> : null}
                <h3 className="text-lg font-black">{p.label}</h3>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-5xl font-black tabular-nums">{p.priceText}</span>
                  <span className="mb-1.5 text-base font-bold text-[#c3cdf0]/70">ج.م شهرياً</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-[13.5px]">
                  {[...p.highlights, "بلا عمولة على المبيعات"].map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" /> {b}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <div className="mx-auto mt-8 max-w-3xl space-y-2 text-center text-[13px] leading-7 text-[#c3cdf0]/70">
            <p>
              تجربة مجانية {fmtPrice(trialHours)} ساعة قبل الدفع.
              {changesPerYear ? ` ويشمل الاشتراك ${changesLabel(changesPerYear)} خلال سنة الاشتراك ينفذها فريقنا، وما عداها تعدّلونه بأنفسكم من اللوحة.` : ""}
            </p>
            <p>الدفع بفودافون كاش أو إنستاباي، ونفعّل متجركم فور مراجعة الإيصال.</p>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Primary />
            <Demo />
          </div>
        </section>

        {reviews.length ? <TestimonialsSection reviews={reviews} /> : null}

        {/* ─── الأسئلة ─── */}
        <section id="faq" className="container-x scroll-mt-24 pb-24 sm:pb-32">
          <Heading eyebrow="أسئلة" title="قبل أن تبدأوا" />
          <div className="mx-auto mt-12 max-w-3xl space-y-3">
            {landingFaq({ trialHours, graceDays, plans }).map(([q, a]) => (
              <details key={q} className="land-card group rounded-2xl px-5 py-4 open:bg-white/[0.05]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-black">
                  {q}
                  <ChevronDown className="size-4 shrink-0 text-[#8d97c4] transition group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-3 text-[14px] leading-8 text-[#c3cdf0]/80">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ─── الختام ─── */}
        <section className="container-x pb-28">
          <div className="relative overflow-hidden rounded-[2.2rem] border border-white/10 bg-gradient-to-l from-[#6f86ff]/25 via-[#0d1230] to-emerald-400/10 px-6 py-14 text-center sm:px-12 sm:py-20">
            <div aria-hidden="true" className="land-orb absolute -bottom-24 start-1/2 size-80 -translate-x-1/2 rounded-full bg-[#6f86ff]/30 blur-3xl rtl:translate-x-1/2" />
            <h2 className="relative text-3xl font-black leading-tight sm:text-5xl">ابدأوا بمحادثة قصيرة</h2>
            <p className="relative mx-auto mt-4 max-w-md text-[15px] leading-8 text-[#c3cdf0]/80">وتجرّبون متجركم {fmtPrice(trialHours)} ساعة كاملة قبل أن تدفعوا أي شيء.</p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Primary />
              <Demo />
            </div>
          </div>
        </section>
      </main>

      <Footer igUrl={igUrl} />
    </div>
  );
}

function Heading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-3xl font-black leading-tight sm:text-[2.6rem]">{title}</h2>
      {subtitle ? <p className="max-w-xl text-[15px] leading-8 text-[#c3cdf0]/75 sm:text-base">{subtitle}</p> : null}
    </div>
  );
}

function Feature({ icon: Icon, title, text }: { icon: typeof Camera; title: string; text: string }) {
  return (
    <article className="land-card land-spot group relative overflow-hidden rounded-3xl p-5 sm:p-6">
      <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#6f86ff]/30 to-emerald-400/10 text-[#c9d4ff] transition group-hover:scale-110">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-[16px] font-black">{title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-7 text-[#c3cdf0]/75">{text}</p>
    </article>
  );
}

/** الأسئلة الشائعة (تُستخدم أيضاً في البيانات المنظمة FAQPage). */
export function landingFaq(o: { trialHours: number; graceDays: number; plans: PlanCard[] }): [string, string][] {
  const renewals = o.plans.map((p) => `${p.label} ${p.priceText} ج.م شهرياً`).join("، ");
  return [
    ["كيف أبدأ؟", "راسلونا على إنستجرام. نسأل عن نشاطكم وبياناتكم الأساسية في محادثة قصيرة، ثم يصلكم رابط إعداد المتجر لتدخلوا به بحساب Google وتكملوا الباقي بأنفسكم."],
    ["كم يستغرق التجهيز؟", "خلال يوم إلى 4 أيام عمل كحد أقصى، وغالباً أسرع. ونخبركم في المحادثة حين يكون رابط الإعداد جاهزاً."],
    ["هل التجربة مجانية؟", `نعم، ${o.trialHours} ساعة بعد تفعيل متجركم، بلا بطاقة بنكية. وإن لم تُفعّلوه بعدها لا تدفعون شيئاً، ويتوقف المتجر ثم يُحذف بعد إشعارات تصلكم قبل ذلك.`],
    ["ماذا تشمل الباقة؟", "تجهيز المتجر ولوحة التحكم مرة واحدة، ثم الاستضافة والتشغيل والتحديثات شهرياً بحدود باقتكم المعلنة، وبلا عمولة على مبيعاتكم أبداً."],
    ["كيف أدفع؟", "بتحويل فودافون كاش أو إنستاباي ورفع صورة الإيصال من لوحتكم. نراجعه ونفعّل متجركم، ويصلكم بريد فور التفعيل."],
    ["كم تكلفة التجديد؟", `التجديد للاستضافة الشهرية فقط بلا رسوم تجهيز: ${renewals}. تختارون الباقة وعدد الأشهر عند كل تجديد، وتُضاف المدة إلى نهاية اشتراككم الحالي فلا يضيع يوم.`],
    ["ماذا يحدث إذا انتهى الاشتراك؟", `نذكّركم قبل الانتهاء بشهر وأسبوع ويوم. وبعده يستمر المتجر ${fmtPrice(o.graceDays)} ${o.graceDays <= 2 ? "يوماً" : o.graceDays <= 10 ? "أيام" : "يوماً"} سماحاً، ثم يتوقف عن الظهور للزوار دون حذف أي شيء، ويعود فور التجديد بنفس الرابط.`],
    ["هل أستطيع تعديل متجري؟", "طبعاً. أغلب ما تحتاجونه تعدّلونه بأنفسكم من اللوحة في أي وقت، ويشمل اشتراككم طلبات تعديل ينفذها فريقنا، ويمكنكم رؤية رصيدها في اللوحة."],
    ["هل هناك حدود للاستخدام؟", "لكل باقة حدود معلنة لعدد المنتجات ومساحة الصور والفيديو والعمليات التلقائية والبحث بالصورة وأعضاء الفريق، والطلبات والزوار بلا حد. تظهر لكم العدّادات في صفحة الاشتراك، ونخبركم قبل بلوغ أي حد، ويمكن الترقية في أي وقت."],
    ["هل أستطيع ربط دومين خاص؟", "نعم، من اللوحة. تظهر لكم السجلات المطلوبة، وتُفعّل الشهادة الآمنة تلقائياً."],
    ["هل يسجّل زبائني حسابات؟", "لا. يطلب الزبون دون حساب، وتُحفظ مفضلته وطلباته على جهازه، ويصلكم الطلب مع رسالة واتساب جاهزة."],
  ];
}
