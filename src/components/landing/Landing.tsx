// Landing — صفحة Colapia الرئيسية. تُرسم على الخادم بالكامل (سرعة وظهور في البحث)، والتفاعل في جزر صغيرة:
// الهيدر، وزر Google، وعرض المتاجر المتبدلة. كل جملة هنا صحيحة حرفياً عن المنتج كما هو اليوم.
import Link from "next/link";
import {
  Wand2,
  PenLine,
  Clapperboard,
  Wallet,
  PackageCheck,
  LayoutDashboard,
  Bot,
  ShieldCheck,
  Github,
  Server,
  Database,
  Image as ImageIcon,
  Cpu,
  Check,
  X,
  ArrowLeft,
  Timer,
  BadgePercent,
  KeyRound,
  ClipboardList,
  Sparkles,
  Rocket,
  ChevronDown,
} from "lucide-react";
import { CosmicBackdrop } from "./CosmicBackdrop";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { GoogleAuthCta } from "./GoogleAuthCta";
import { TestimonialsSection } from "./TestimonialsSection";
import { StoreMorph } from "./StoreMorph";
import { MINI_STORES, StoreMini } from "./StoreMini";
import { CTA_GHOST, CTA_PRIMARY, Eyebrow, fmtEGP } from "./shared";
import type { LandingPricing, LandingReview, SessionState } from "./types";

type Props = { session: SessionState; reviews: LandingReview[]; pricing: LandingPricing; trialHours: number };

export function Landing({ session, reviews, pricing, trialHours }: Props) {
  const merchant = session === "merchant";
  const discount = Math.max(0, Math.round(100 - (pricing.price / pricing.basePrice) * 100));

  const Primary = ({ label }: { label: string }) =>
    merchant ? (
      <Link href="/dashboard" className={CTA_PRIMARY}>
        <LayoutDashboard className="size-5" aria-hidden="true" /> افتح لوحة متجرك
      </Link>
    ) : (
      <GoogleAuthCta redirectTo="/dashboard" label={label} className={CTA_PRIMARY} />
    );

  return (
    <div dir="rtl" lang="ar" className="land relative min-h-dvh overflow-x-clip bg-[#07091a] text-[#eaf0ff]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-[#8fa8ff] focus:px-4 focus:py-2 focus:text-[#07091a]">
        تخطَّ إلى المحتوى الرئيسي
      </a>
      <CosmicBackdrop />
      <Header session={session} />

      <main id="main-content">
        {/* ─── الواجهة ─── */}
        <section className="container-x grid items-center gap-12 pb-20 pt-8 sm:pt-14 lg:grid-cols-[1.15fr_1fr] lg:gap-8 lg:pb-28">
          <div className="land-rise flex flex-col items-start gap-6">
            <Eyebrow>
              <Sparkles className="size-3.5 text-[#8fa8ff]" aria-hidden="true" /> متاجر يصممها الذكاء الاصطناعي، لمصر
            </Eyebrow>
            <h1 className="text-[2.2rem] font-black leading-[1.15] tracking-tight sm:text-5xl lg:text-[3.6rem]">
              متجر يُصمَّم ويُكتب <span className="land-gradient-text">لك وحدك</span>
              <br />
              ثم يصبح ملكك للأبد
            </h1>
            <p className="max-w-xl text-base leading-8 text-[#c3cdf0]/85 sm:text-lg">
              اوصف نشاطك ومنتجاتك في 5 خطوات قصيرة. مدير فني بالذكاء الاصطناعي يصمم هوية متجرك، وكاتب محتوى يكتب كل كلمة فيه من سياساتك الحقيقية.
              جرّبه {trialHours} ساعة مجاناً، وإن أعجبك ادفع مرة واحدة واستلمه على حساباتك أنت.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Primary label="ابدأ متجرك مجاناً" />
              <a href="#how" className={CTA_GHOST}>
                شاهد كيف يعمل
              </a>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-[#c3cdf0]/75">
              {["بلا بطاقة بنكية", "بلا اشتراك شهري", "بلا عمولة على مبيعاتك"].map((t) => (
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
              { icon: BadgePercent, big: "0%", small: "عمولة على أي بيعة" },
              { icon: Wallet, big: "مرة واحدة", small: "تدفع ولا تتكرر" },
              { icon: Timer, big: `${trialHours} ساعة`, small: "تجربة كاملة قبل الدفع" },
              { icon: KeyRound, big: "حساباتك", small: "الكود والبيانات باسمك" },
            ].map(({ icon: Icon, big, small }) => (
              <li key={small} className="flex flex-col gap-1 bg-[#0a0e24] p-5 sm:p-6">
                <Icon className="size-5 text-[#8fa8ff]" aria-hidden="true" />
                <span className="mt-2 text-2xl font-black sm:text-3xl">{big}</span>
                <span className="text-[13px] text-[#c3cdf0]/70">{small}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── كيف يعمل ─── */}
        <section id="how" className="container-x scroll-mt-24 py-24 sm:py-32">
          <Heading eyebrow="كيف يعمل" title="من فكرة في رأسك إلى متجر يبيع، في جلسة واحدة" />
          <ol className="relative mt-14 grid gap-4 md:grid-cols-4">
            {[
              { icon: ClipboardList, t: "اوصف متجرك", d: "اسمك ونشاطك ومنتجاتك بصورها وأسعارها ومقاساتها، وسياسة الشحن والاستبدال. 5 خطوات تعمل من الموبايل." },
              { icon: Wand2, t: "يُبنى أمامك", d: "تتابع البناء خطوة بخطوة: الاتجاه الفني، ثم النصوص، ثم الكتالوج، ثم التصميم والصفحات." },
              { icon: Timer, t: `جرّبه ${trialHours} ساعة`, d: "متجرك ولوحة تحكمه يعملان بالكامل: أضف منتجات، استقبل طلبات، وأعد التصميم إن أردت." },
              { icon: Rocket, t: "ادفع مرة وامتلكه", d: "بعد الدفع ينتقل متجرك بكل بياناته إلى حسابات باسمك، بخطوات مشروحة من الموبايل." },
            ].map(({ icon: Icon, t, d }, i) => (
              <li key={t} className="land-card group relative flex flex-col gap-3 rounded-3xl p-6">
                <span className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-2xl bg-[#6f86ff]/15 text-[#8fa8ff] transition group-hover:scale-110">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-3xl font-black text-white/10">0{i + 1}</span>
                </span>
                <h3 className="text-lg font-black">{t}</h3>
                <p className="text-[13.5px] leading-7 text-[#c3cdf0]/75">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ─── لا قوالب ─── */}
        <section id="designs" className="scroll-mt-24 border-y border-white/5 bg-gradient-to-b from-transparent via-[#0b1030]/60 to-transparent py-24 sm:py-32">
          <div className="container-x">
            <Heading
              eyebrow="لا قوالب"
              title="كل متجر يُصمَّم من الصفر لنشاطه"
              subtitle="الألوان والخطوط وشكل البطاقات والأزرار وحتى نبرة الكلام يقررها مدير فني بالذكاء الاصطناعي لكل متجر على حدة. لا يوجد متجران متشابهان."
            />
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {MINI_STORES.map((s) => (
                <figure key={s.name} className="land-tilt">
                  <div className="aspect-[3/4] overflow-hidden rounded-[1.6rem] border border-white/10 shadow-2xl">
                    <StoreMini s={s} animate={false} />
                  </div>
                  <figcaption className="mt-3 flex items-center justify-between px-1 text-[12.5px]">
                    <span className="font-black">{s.name}</span>
                    <span className="text-[#8d97c4]">«{s.concept}»</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ─── المميزات ─── */}
        <section id="features" className="container-x scroll-mt-24 py-24 sm:py-32">
          <Heading eyebrow="ما تحصل عليه" title="متجر احترافي ولوحة تحكم كاملة، لا نسخة مبسطة" />
          <div className="mt-14 grid gap-4 md:grid-cols-6">
            <Feature className="md:col-span-3" icon={Wand2} title="مدير فني لمتجرك" text="يختار لوحة ألوان عالية التباين وخطوطاً عربية وشكل كل بطاقة وزر وقسم، ويكتب لمسات تصميم خاصة بمتجرك وحده." />
            <Feature className="md:col-span-3" icon={PenLine} title="نصوص لا تكذب على عملائك" text="كل شارة ثقة أو سؤال شائع يُفحص مقابل سياستك الحالية عند كل عرض: لو غيّرت الشحن أو الاستبدال يتغير الكلام معه تلقائياً." />
            <Feature className="md:col-span-2" icon={Clapperboard} title="حركة سينمائية وعمق ثلاثي الأبعاد" text="عناوين تتكشف، وصور تتنفس، وبطاقات تميل مع المؤشر. تختار المستوى: هادئ أو حيوي أو سينمائي." />
            <Feature className="md:col-span-2" icon={Wallet} title="شراء واحد ذكي" text="العميل يختار متى يدفع: عند الاستلام برسومها الحقيقية، أو مقدماً بفودافون كاش وإنستاباي بالمبلغ المطلوب بالضبط." />
            <Feature className="md:col-span-2" icon={PackageCheck} title="«طلباتي» بلا حسابات" text="كل طلب يُحفظ على جهاز العميل؛ يرى حالته في أي وقت دون تسجيل ولا حفظ رقم، ويصله بريد مع كل خطوة إن كتب بريده." />
            <Feature className="md:col-span-4" icon={LayoutDashboard} title="لوحة تحكم تدير بها كل شيء" text="منتجات بمقاسات وألوان ومخزون، وطلبات بحالاتها، وعملاء، وأكواد خصم، ومناطق شحن، وفواتير للطباعة وPDF برمز تتبع، وتصدير Excel، وتحليلات زيارات حقيقية تحسب كل جهاز مرة واحدة في اليوم." />
            <Feature className="md:col-span-2" icon={Bot} title="نوفا، مساعدك الذكي" text="اسأله عن مبيعاتك ومنتجاتك فيجيب من بيانات متجرك، ويكتب لك أوصاف المنتجات." />
          </div>
        </section>

        {/* ─── الملكية ─── */}
        <section id="ownership" className="scroll-mt-24 py-24 sm:py-32">
          <div className="container-x">
            <div className="land-card relative overflow-hidden rounded-[2rem] p-7 sm:p-12">
              <div aria-hidden="true" className="absolute -end-24 -top-24 size-72 rounded-full bg-emerald-400/15 blur-3xl" />
              <div className="relative grid items-center gap-10 lg:grid-cols-2">
                <div className="space-y-5">
                  <Eyebrow>
                    <ShieldCheck className="size-3.5 text-emerald-400" aria-hidden="true" /> ليس اشتراكاً. ملكك.
                  </Eyebrow>
                  <h2 className="text-3xl font-black leading-tight sm:text-4xl">متجرك يعيش على حساباتك أنت، لا عندنا</h2>
                  <p className="text-[15px] leading-8 text-[#c3cdf0]/80">
                    بعد الدفع ينتقل متجرك ولوحة تحكمه بكل منتجاتك وطلباتك وعملائك وصورك إلى حسابات باسمك. الخطوات مشروحة من الموبايل، وتأخذ نحو 10 دقائق.
                    لا نحتفظ بأي مفتاح لحساباتك، ونحذف بيانات متجرك من عندنا فور اكتمال الاستلام، ورابطك القديم يحوّل زوارك لموقعك الجديد.
                  </p>
                </div>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    { icon: Github, n: "GitHub", d: "كود متجرك" },
                    { icon: Server, n: "Vercel", d: "تشغيل الموقع" },
                    { icon: Database, n: "Neon", d: "قاعدة البيانات" },
                    { icon: ImageIcon, n: "UploadThing", d: "الصور" },
                    { icon: Cpu, n: "Groq", d: "الذكاء الاصطناعي" },
                    { icon: KeyRound, n: "مفاتيحك", d: "معك وحدك" },
                  ].map(({ icon: Icon, n, d }) => (
                    <li key={n} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <Icon className="size-5 text-emerald-300" aria-hidden="true" />
                      <p className="mt-2 text-[14px] font-black" dir="auto">
                        {n}
                      </p>
                      <p className="text-[12px] text-[#c3cdf0]/65">{d}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ─── السعر ─── */}
        <section id="pricing" className="container-x scroll-mt-24 py-24 sm:py-32">
          <Heading eyebrow="السعر" title="دفعة واحدة. لا شيء بعدها لنا." />
          <div className="mx-auto mt-14 grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_1fr]">
            <div className="relative overflow-hidden rounded-[2rem] border border-[#8fa8ff]/30 bg-gradient-to-b from-[#8fa8ff]/12 via-[#0e1430] to-[#0b1026] p-8 shadow-[0_40px_120px_-30px_rgba(111,134,255,0.45)] sm:p-10">
              {discount ? (
                <span className="absolute end-6 top-6 rounded-full bg-[#8fa8ff]/15 px-3 py-1 text-xs font-black text-[#c9d4ff]">خصم {fmtEGP(discount)}%</span>
              ) : null}
              <p className="text-sm font-bold text-[#c3cdf0]/70">متجرك كاملاً، ملكاً لك</p>
              <div className="mt-3 flex items-end gap-3">
                <span className="text-6xl font-black tabular-nums">{fmtEGP(pricing.price)}</span>
                <span className="mb-2 text-lg font-bold text-[#c3cdf0]/70">ج.م</span>
                {pricing.basePrice > pricing.price ? <span className="mb-2.5 text-sm text-[#c3cdf0]/50 line-through">{fmtEGP(pricing.basePrice)} ج.م</span> : null}
              </div>
              <p className="mt-1 text-[13px] text-[#c3cdf0]/70">مرة واحدة فقط. بعد تجربة {trialHours} ساعة تقرر فيها بنفسك.</p>
              <ul className="mt-8 space-y-3 text-[14px]">
                {[
                  "متجر كامل صممه وكتبه الذكاء الاصطناعي لنشاطك",
                  "لوحة تحكم كاملة بالطلبات والفواتير والتحليلات",
                  "نقل المتجر وبياناته لحساباتك بخطوات مشروحة",
                  "بلا عمولة على مبيعاتك وبلا اشتراك لنا",
                  "مساعد ذكي في لوحتك يعمل بمفتاحك المجاني",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4.5 shrink-0 text-emerald-400" aria-hidden="true" /> {b}
                  </li>
                ))}
              </ul>
              <div className="mt-9">
                <Primary label={`ابدأ تجربة ${trialHours} ساعة مجاناً`} />
              </div>
              <p className="mt-4 text-[11.5px] leading-6 text-[#c3cdf0]/55">
                الدفع بتحويل فودافون كاش أو إنستاباي، ونفعّل متجرك فور مراجعة الإيصال. لو تجاوز متجرك الخطط المجانية لمزوّدي الاستضافة، تدفع لهم مباشرة.
              </p>
            </div>

            <div className="land-card rounded-[2rem] p-6 sm:p-8">
              <p className="text-[15px] font-black">مقارنة صريحة</p>
              <table className="mt-5 w-full text-[13px]">
                <thead>
                  <tr className="text-[#8d97c4]">
                    <th className="pb-3 text-start font-bold" />
                    <th className="pb-3 text-start font-black text-white">Colapia</th>
                    <th className="pb-3 text-start font-bold">منصات الاشتراك</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    ["الدفع", "مرة واحدة", "كل شهر"],
                    ["عمولة المبيعات", "لا يوجد", "غالباً نسبة"],
                    ["التصميم", "مصمم لمتجرك", "قالب مشترك"],
                    ["الكود والبيانات", "ملكك", "على المنصة"],
                    ["لو قررت المغادرة", "متجرك معك", "تبدأ من جديد"],
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
            </div>
          </div>
        </section>

        {reviews.length ? <TestimonialsSection reviews={reviews} /> : null}

        {/* ─── الأسئلة ─── */}
        <section id="faq" className="container-x scroll-mt-24 py-24 sm:py-32">
          <Heading eyebrow="أسئلة" title="قبل ما تبدأ" />
          <div className="mx-auto mt-12 max-w-3xl space-y-3">
            {faq(trialHours).map(([q, a]) => (
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
            <h2 className="relative text-3xl font-black leading-tight sm:text-5xl">متجرك القادم يبدأ بوصف بسيط</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-[15px] leading-8 text-[#c3cdf0]/80">
              5 خطوات، ثم تتابع متجرك يُبنى أمامك. تجربة {trialHours} ساعة كاملة قبل أن تدفع أي شيء.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Primary label="ابدأ الآن مجاناً" />
              <a href="#designs" className={CTA_GHOST}>
                شاهد أمثلة <ArrowLeft className="size-4" aria-hidden="true" />
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
      {subtitle ? <p className="max-w-2xl text-[15px] leading-8 text-[#c3cdf0]/75 sm:text-base">{subtitle}</p> : null}
    </div>
  );
}

function Feature({ icon: Icon, title, text, className }: { icon: typeof Wand2; title: string; text: string; className?: string }) {
  return (
    <article className={`land-card land-spot group relative overflow-hidden rounded-3xl p-6 sm:p-7 ${className ?? ""}`}>
      <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#6f86ff]/30 to-emerald-400/10 text-[#c9d4ff] transition group-hover:scale-110">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-lg font-black">{title}</h3>
      <p className="mt-2 text-[13.5px] leading-7 text-[#c3cdf0]/75">{text}</p>
    </article>
  );
}

function faq(h: number): [string, string][] {
  return [
    ["كم يستغرق بناء متجري؟", "الاستمارة 5 خطوات قصيرة، وبعدها يُبنى متجرك خلال دقائق وأنت تتابع كل مرحلة على الشاشة. لو تعثر الذكاء الاصطناعي في أي جزء، يُكمل البناء ببديل مشتق من بياناتك، لا بنص عام."],
    ["هل التجربة مجانية فعلاً؟", `نعم. ${h} ساعة كاملة بمتجرك ولوحة تحكمه، بلا بطاقة بنكية. لو لم يعجبك لا تدفع شيئاً.`],
    ["كيف أدفع، ومتى يتفعّل متجري؟", "تحوّل المبلغ بفودافون كاش أو إنستاباي وترفع صورة الإيصال من لوحتك. نراجع الإيصال بأنفسنا ونفعّل متجرك، ويصلك بريد فور التفعيل."],
    ["ماذا يعني أن المتجر ملكي للأبد؟", "بعد الدفع تستلم كود متجرك ولوحة تحكمه في مستودع GitHub باسمك، وتنشره على Vercel بقاعدة بيانات Neon، وتنتقل إليه كل منتجاتك وطلباتك وعملائك وصورك. بعدها لا يعتمد متجرك علينا في أي شيء."],
    ["هل أحتاج خبرة تقنية؟", "لا. كل خطوة مشروحة بالعربي وتعمل من الموبايل: زر يُنشئ المستودع، ونسخ ولصق لمفتاحين مجانيين، وكود استلام. لو احتجت مساعدة تواصل معنا."],
    ["هل توجد تكاليف بعد الدفع؟", "لا شيء لنا: لا اشتراك ولا عمولة. المتجر يعمل على حساباتك لدى مزوّدي الاستضافة، ولكل منهم خطة مجانية للبداية؛ إن كبر متجرك وتجاوزها تدفع لهم مباشرة."],
    ["هل أقدر أغيّر التصميم؟", "نعم. من «تصميم المتجر» تعيد التصميم بالذكاء الاصطناعي بضغطة وتستعيد أي تصميم سابق، وتختار مستوى الحركة، وتعدّل الألوان والنصوص والسياسات من لوحة التحكم."],
    ["هل يحتاج عملائي لإنشاء حساب؟", "لا. العميل يطلب باسمه ورقمه، ويجد طلباته محفوظة على جهازه في «طلباتي» بحالتها الحية، ويصله بريد مع كل خطوة إن كتب بريده."],
  ];
}
