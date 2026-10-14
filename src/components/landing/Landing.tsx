// Landing — صفحة Colapia الرئيسية. تُرسم على الخادم بالكامل (سرعة وظهور في البحث)، والتفاعل في جزر صغيرة:
// الهيدر، وزر Google، وعرض المتاجر المتبدلة. كل جملة هنا يجب أن تكون صحيحة عن الخدمة: بلا إشارة إلى أدوات الذكاء الاصطناعي ولا تقنيات التشغيل (لا قيمة للعميل فيها).
// النص قليل عمداً: عنوان وسطر لكل فكرة، والصور واللقطات الحقيقية تقوم بالباقي.
import Link from "next/link";
import Image from "next/image";
import {
  Check,
  X,
  ArrowLeft,
  ClipboardList,
  LayoutDashboard,
  ChevronDown,
  Camera,
  ShieldCheck,
  MessageCircle,
  Megaphone,
  Ruler,
  BellRing,
  Globe,
  Receipt,
  Smartphone,
  PenTool,
  Rocket,
  Timer,
  BadgePercent,
  Server,
  Hourglass,
} from "lucide-react";
import { CosmicBackdrop } from "./CosmicBackdrop";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { TestimonialsSection } from "./TestimonialsSection";
import { StoreMorph } from "./StoreMorph";
import { MINI_STORES, StoreMini } from "./StoreMini";
import { CTA_GHOST, CTA_PRIMARY, Eyebrow, fmtEGP } from "./shared";
import type { LandingPricing, LandingReview, SessionState } from "./types";

type Props = { session: SessionState; reviews: LandingReview[]; pricing: LandingPricing; trialHours: number; changesPerMonth: number };

export function Landing({ session, reviews, pricing, trialHours, changesPerMonth }: Props) {
  const merchant = session === "merchant";

  // كل الطرق تبدأ من استمارة الطلب (لا تسجيل ولا حساب قبلها). من لديه متجر يفتح لوحته من الهيدر.
  const Primary = ({ label }: { label: string }) =>
    merchant ? (
      <Link href="/dashboard" className={CTA_PRIMARY}>
        <LayoutDashboard className="size-5" aria-hidden="true" /> لوحة متجرك
      </Link>
    ) : (
      <Link href="/start" className={CTA_PRIMARY}>
        <ClipboardList className="size-5" aria-hidden="true" /> {label}
      </Link>
    );

  return (
    <div dir="rtl" lang="ar" suppressHydrationWarning className="land relative min-h-dvh overflow-x-clip bg-[#07091a] text-[#eaf0ff]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-[#8fa8ff] focus:px-4 focus:py-2 focus:text-[#07091a]">
        تخطَّ إلى المحتوى الرئيسي
      </a>
      <script
        dangerouslySetInnerHTML={{
          __html: `try{var t=localStorage.getItem("clp-land-theme");if(t==="light"||(!t&&matchMedia("(prefers-color-scheme: light)").matches))document.currentScript.parentElement.classList.add("land-light")}catch(e){}`,
        }}
      />
      <CosmicBackdrop />
      <Header session={session} />

      <main id="main-content">
        {/* ─── الواجهة ─── */}
        <section className="container-x grid items-center gap-10 pb-16 pt-6 sm:pt-12 lg:grid-cols-[1.1fr_1fr] lg:gap-8 lg:pb-24">
          <div className="land-rise flex flex-col items-start gap-6">
            <Eyebrow>للبراندات التي تبيع عبر السوشيال ميديا</Eyebrow>
            <h1 className="text-[2.35rem] font-black leading-[1.12] tracking-tight sm:text-5xl lg:text-[3.7rem]">
              متجر يليق ببراندك
              <br />
              <span className="land-gradient-text">ويبيع عنك</span>
            </h1>
            <p className="max-w-lg text-base leading-8 text-[#c3cdf0]/85 sm:text-lg">
              نصمّمه ونبنيه ونستضيفه نيابةً عنك. وتجرّبه {trialHours} ساعة كاملة قبل أي دفع.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Primary label="اطلب متجرك" />
              <a href="#designs" className={CTA_GHOST}>
                شاهد الأمثلة
              </a>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-[#c3cdf0]/75">
              {["بلا عمولة على المبيعات", "سنة استضافة مشمولة", "لوحة تحكم بالعربية"].map((t) => (
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
              { icon: BadgePercent, big: "0%", small: "عمولة على المبيعات" },
              { icon: Server, big: "سنة", small: "استضافة وتشغيل مشمولان" },
              { icon: Timer, big: `${trialHours} ساعة`, small: "تجربة قبل الدفع" },
              { icon: Hourglass, big: "12 ساعة – 4 أيام", small: "مدة التسليم" },
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
          <Heading eyebrow="كيف يعمل" title="ثلاث خطوات، وتبدأ البيع" />
          <ol className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              { icon: ClipboardList, t: "استمارة من دقيقتين", d: "منتجاتك وطرق الدفع والتوصيل، وأي طلب خاص تريده." },
              { icon: PenTool, t: "نصمّم ونبني", d: "فريقنا يجهّز متجرك ولوحته، وتتابع كل مرحلة من صفحة طلبك." },
              { icon: Rocket, t: `تجربة ${trialHours} ساعة ثم تفعيل`, d: "تستلم متجرك وتجرّبه بطلبات حقيقية، ولا تدفع إلا لو أعجبك." },
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
        </section>

        {/* ─── أمثلة ─── */}
        <section id="designs" className="scroll-mt-24 border-y border-white/5 bg-gradient-to-b from-transparent via-[#0b1030]/60 to-transparent py-24 sm:py-32">
          <div className="container-x">
            <Heading eyebrow="أمثلة" title="هوية تناسب كل نشاط" subtitle="نماذج توضيحية لاتجاهات مختلفة. متجرك يُصمَّم من الصفر لنشاطك." />
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
          </div>
        </section>

        {/* ─── لوحة التحكم ─── */}
        <section id="dashboard" className="container-x scroll-mt-24 py-24 sm:py-32">
          <Heading eyebrow="لوحة التحكم" title="كل متجرك في شاشة واحدة" subtitle="طلبات وعملاء ومخزون وتقارير، بالعربية، وتعمل من الموبايل كما من الكمبيوتر." />
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
          <ul className="mx-auto mt-20 grid max-w-5xl gap-3 text-[14px] sm:grid-cols-2 lg:grid-cols-4">
            {["الطلبات وحالاتها ورسائل واتساب الجاهزة", "مخزون بالمقاسات والألوان", "فواتير للطباعة وتصدير Excel", "إحصاءات زيارات ومبيعات حقيقية"].map((t) => (
              <li key={t} className="flex items-start gap-2 text-[#c3cdf0]/85">
                <Check className="mt-1 size-4 shrink-0 text-emerald-400" aria-hidden="true" /> {t}
              </li>
            ))}
          </ul>
        </section>

        {/* ─── مبني لطريقة البيع ─── */}
        <section id="features" className="container-x scroll-mt-24 pb-24 sm:pb-32">
          <Heading eyebrow="مبني لطريقة بيعك" title="أدوات من واقع البيع على السوشيال" />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feature icon={Camera} title="البحث بالصورة" text="يرفع الزبون لقطة من الريلز، فيصل للقطعة نفسها أو الأقرب لها." />
            <Feature icon={ShieldCheck} title="درع الدفع عند الاستلام" text="تأكيد من الزبون قبل الشحن، وتقدير لمخاطرة كل طلب، وعربون عند الحاجة." />
            <Feature icon={MessageCircle} title="الطلب على واتساب" text="رسالة جاهزة برقم الطلب وأصنافه والإجمالي، بضغطة واحدة." />
            <Feature icon={Megaphone} title="جاهز لإعلاناتك" text="بكسل ميتا وتيك توك، وروابط حملات، وكتالوج لإعلانات ميتا." />
            <Feature icon={Ruler} title="مقاسات وألوان" text="لكل لون كميته وصورته، ودليل مقاسات يقترح المناسب." />
            <Feature icon={BellRing} title="نبّهني عند التوفر" text="الزبون يسجّل رقمه للقطعة النافدة، وأنت تبلغه بضغطة." />
            <Feature icon={Globe} title="نطاقك الخاص" text="اربط دومين براندك من لوحتك، والشهادة الآمنة تلقائية." />
            <Feature icon={Smartphone} title="سريع على الموبايل" text="تصميم مبني للموبايل أولاً، حيث يتصفح أغلب زبائنك." />
          </div>
        </section>

        {/* ─── السعر ─── */}
        <section id="pricing" className="container-x scroll-mt-24 pb-24 sm:pb-32">
          <Heading eyebrow="السعر" title="باقة واحدة، وتجديدها معلن من اليوم الأول" />
          <div className="mx-auto mt-14 grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_1fr]">
            <div className="relative overflow-hidden rounded-[2rem] border border-[#8fa8ff]/30 bg-gradient-to-b from-[#8fa8ff]/12 via-[#0e1430] to-[#0b1026] p-8 shadow-[0_40px_120px_-30px_rgba(111,134,255,0.45)] sm:p-10">
              <p className="text-sm font-bold text-[#c3cdf0]/70">متجرك كاملاً + سنة استضافة</p>
              <div className="mt-3 flex items-end gap-3">
                <span className="text-6xl font-black tabular-nums">{fmtEGP(pricing.price)}</span>
                <span className="mb-2 text-lg font-bold text-[#c3cdf0]/70">ج.م</span>
              </div>
              <p className="mt-1 text-[13px] text-[#c3cdf0]/70">بعدها {fmtEGP(pricing.renewal)} ج.م للسنة. وتجرّب متجرك {trialHours} ساعة قبل أن تدفع.</p>
              <ul className="mt-8 space-y-3 text-[14px]">
                {[
                  "متجر مصمَّم لنشاطك وفق طلبك",
                  "لوحة تحكم كاملة",
                  "البحث بالصورة ودرع الدفع عند الاستلام",
                  changesPerMonth ? `${changesLabel(changesPerMonth)} شهرياً ينفذها فريقنا` : "متابعة معك بعد التسليم",
                  "بلا عمولة على مبيعاتك",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4.5 shrink-0 text-emerald-400" aria-hidden="true" /> {b}
                  </li>
                ))}
              </ul>
              <div className="mt-9">
                <Primary label="اطلب متجرك" />
              </div>
              <p className="mt-4 text-[11.5px] leading-6 text-[#c3cdf0]/55">الدفع بفودافون كاش أو إنستاباي، ونفعّل متجرك فور مراجعة الإيصال.</p>
            </div>

            <div className="land-card rounded-[2rem] p-6 sm:p-8">
              <p className="text-[15px] font-black">مقارنة صريحة</p>
              <table className="mt-5 w-full text-[13px]">
                <thead>
                  <tr className="text-[#8d97c4]">
                    <th className="pb-3 text-start font-bold" />
                    <th className="pb-3 text-start font-black text-[#eaf0ff]">Colapia</th>
                    <th className="pb-3 text-start font-bold">منصات الاشتراك</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    ["الدفع", "سنوي بسعر معلن", "كل شهر"],
                    ["العمولة", "لا يوجد", "غالباً نسبة"],
                    ["التصميم", "مصمَّم لمتجرك", "قالب مشترك"],
                    ["بياناتك", "ملكك", "على المنصة"],
                    ["عند التأخر في الدفع", "يتوقف دون حذف", "قد تفقد المتجر"],
                  ].map(([k, a, b]) => (
                    <tr key={k}>
                      <td className="py-3 text-[#c3cdf0]/70">{k}</td>
                      <td className="py-3 font-bold text-emerald-300">
                        <span className="inline-flex items-center gap-1">
                          <Check className="size-3.5" aria-hidden="true" /> {a}
                        </span>
                      </td>
                      <td className="py-3 text-[#c3cdf0]/60">
                        <span className="inline-flex items-center gap-1">
                          <X className="size-3.5 text-rose-300/70" aria-hidden="true" /> {b}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-6 flex items-start gap-2 text-[12.5px] leading-6 text-[#c3cdf0]/65">
                <Receipt className="mt-0.5 size-4 shrink-0 text-[#8fa8ff]" aria-hidden="true" /> بياناتك ملكك، ونسخة منها متاحة متى طلبتها.
              </p>
            </div>
          </div>
        </section>

        {reviews.length ? <TestimonialsSection reviews={reviews} /> : null}

        {/* ─── الأسئلة ─── */}
        <section id="faq" className="container-x scroll-mt-24 pb-24 sm:pb-32">
          <Heading eyebrow="أسئلة" title="قبل أن تبدأ" />
          <div className="mx-auto mt-12 max-w-3xl space-y-3">
            {faq(trialHours, pricing).map(([q, a]) => (
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
            <h2 className="relative text-3xl font-black leading-tight sm:text-5xl">ابدأ متجرك باستمارة من دقيقتين</h2>
            <p className="relative mx-auto mt-4 max-w-md text-[15px] leading-8 text-[#c3cdf0]/80">وتجرّبه {trialHours} ساعة كاملة قبل أن تدفع أي شيء.</p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Primary label="اطلب متجرك" />
              <a href="#designs" className={CTA_GHOST}>
                شاهد الأمثلة <ArrowLeft className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
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
    <article className={`land-card land-spot group relative overflow-hidden rounded-3xl p-5 sm:p-6`}>
      <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#6f86ff]/30 to-emerald-400/10 text-[#c9d4ff] transition group-hover:scale-110">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-[16px] font-black">{title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-7 text-[#c3cdf0]/75">{text}</p>
    </article>
  );
}

/** «طلب تعديل واحد» / «طلبا تعديل» / «3 طلبات تعديل» / «11 طلب تعديل». */
function changesLabel(n: number): string {
  if (n === 1) return "طلب تعديل واحد";
  if (n === 2) return "طلبا تعديل";
  return `${fmtEGP(n)} ${n <= 10 ? "طلبات" : "طلب"} تعديل`;
}

function faq(h: number, pricing: LandingPricing): [string, string][] {
  return [
    ["كم يستغرق التسليم؟", "من 12 ساعة إلى 4 أيام، ونخبرك بالموعد الفعلي عند إرسال الطلب. وتتابع كل مرحلة من صفحة طلبك."],
    ["ماذا أحتاج لأطلب متجري؟", "اسم المتجر ووسيلة تواصل ومنتجاتك وطرق الدفع والتوصيل. الباقي اختياري، وتستطيع أن تصف لنا ما تريده بحرية."],
    ["هل التجربة مجانية؟", `نعم، ${h} ساعة بعد التسليم بلا بطاقة بنكية. وإن لم يعجبك لا تدفع شيئاً.`],
    ["كيف أدفع؟", "بتحويل فودافون كاش أو إنستاباي ورفع صورة الإيصال. نراجعه ونفعّل متجرك، ويصلك بريد فور التفعيل."],
    ["كم التكلفة بعد السنة الأولى؟", `التجديد ${fmtEGP(pricing.renewal)} ج.م للسنة، وتُضاف السنة إلى نهاية اشتراكك فلا تخسر يوماً. ولا عمولة على مبيعاتك أبداً.`],
    ["ماذا لو لم أجدد؟", "يتوقف متجرك عن الظهور للزوار فقط، ولا نحذف أي شيء. وبالتجديد يعود بنفس الرابط."],
    ["هل أستطيع ربط دومين خاص؟", "نعم، من لوحتك. تظهر لك السجلات المطلوبة ونفعّل النطاق والشهادة الآمنة تلقائياً."],
    ["هل أحتاج خبرة تقنية؟", "لا. نحن نبني ونستضيف ونشغّل، وتدير منتجاتك وطلباتك من لوحة بالعربية تعمل من الموبايل."],
  ];
}
