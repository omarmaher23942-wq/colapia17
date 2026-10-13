// Landing — صفحة Colapia الرئيسية. تُرسم على الخادم بالكامل (سرعة وظهور في البحث)، والتفاعل في جزر صغيرة:
// الهيدر، وزر Google، وعرض المتاجر المتبدلة. كل جملة هنا يجب أن تكون صحيحة عن الخدمة: بلا إشارة إلى أدوات الذكاء الاصطناعي ولا تقنيات التشغيل (لا قيمة للعميل فيها).
import Link from "next/link";
import { Palette, PenLine, Clapperboard, Wallet, PackageCheck, LayoutDashboard, ShieldCheck, Server, Check, X, ArrowLeft, Timer, BadgePercent, ClipboardList, Users, Rocket, ChevronDown, Camera, MessageCircle, Megaphone, Ruler } from "lucide-react";
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
              <Users className="size-3.5 text-[#8fa8ff]" aria-hidden="true" /> لكل براند بيبيع على إنستجرام وتيك توك وفيسبوك
            </Eyebrow>
            <h1 className="text-[2.2rem] font-black leading-[1.15] tracking-tight sm:text-5xl lg:text-[3.6rem]">
              متجر لبراندك <span className="land-gradient-text">يبيع وأنت بتنشر</span>
              <br />
              نبنيه ونستضيفه ونشغّله لك
            </h1>
            <p className="max-w-xl text-base leading-8 text-[#c3cdf0]/85 sm:text-lg">
              بدل «السعر في الخاص» وطلبات تضيع في الرسائل: متجر باسم براندك، عملاؤك يختارون المقاس واللون ويطلبون في دقيقة، والطلب يوصلك منظماً في لوحتك. فريقنا يصممه
              ويبنيه ويراجعه ويسلّمه خلال 12 ساعة إلى 4 أيام، وتجرّبه {trialHours} ساعة قبل أي دفع.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Primary label="طلب متجرك" />
              <a href="#how" className={CTA_GHOST}>
                كيف يعمل
              </a>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-[#c3cdf0]/75">
              {["الطلب مجاني بلا التزام", "سنة استضافة مشمولة", "بلا عمولة على مبيعاتك", "البحث بالصورة داخل متجرك"].map((t) => (
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
              { icon: Server, big: "سنة كاملة", small: "استضافة وتشغيل مشمولان" },
              { icon: Timer, big: `${trialHours} ساعة`, small: "تجربة كاملة قبل الدفع" },
              { icon: Users, big: "12 ساعة – 4 أيام", small: "مدة التسليم بعد إرسال الطلب" },
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
          <Heading eyebrow="كيف يعمل" title="من فكرة في رأسك إلى متجر جاهز، بدون ما تلمس أي شيء تقني" />
          <ol className="relative mt-14 grid gap-4 md:grid-cols-4">
            {[
              { icon: ClipboardList, t: "احكوا لنا عن متجركم", d: "اسم المتجر ووسيلة تواصل، ومنتجاتك (كلام بسيط عن كل منتج وصوره لو موجودة)، وطريقة الدفع والتوصيل. وأسئلة الشكل ممكن يكون جوابها «يختارها الفريق»." },
              { icon: Palette, t: "فريقنا يصمم ويبني", d: "نختار هوية تناسب نشاطك، ونبني الصفحات ونجهّز منتجاتك، وتتابع المرحلة اللي وصلنا لها من صفحة خاصة بطلبك." },
              { icon: Timer, t: `جرّبه ${trialHours} ساعة`, d: "نراجع المتجر ثم يوصلك رابطه ولوحة تحكمه. تجرّب وتطلب الطلبات وتقرر، بدون أي دفع قبلها." },
              { icon: Rocket, t: "فعّله وانطلق", d: "لو أعجبك تحوّل الباقة ونراجع الإيصال ويُفتح متجرك لعملائك على رابطه، ونستضيفه ونشغّله لك سنة كاملة." },
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
              eyebrow="لا قوالب جاهزة"
              title="كل متجر يُصمَّم لنشاطه"
              subtitle="الألوان والخطوط وشكل البطاقات والأزرار ونبرة الكلام يقررها فريق التصميم لكل متجر على حدة. هذه أمثلة على اتجاهات مختلفة، ومتجرك يُصمَّم لنشاطك أنت."
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

        {/* ─── البيع من السوشيال ─── */}
        <section id="social" className="container-x scroll-mt-24 pt-24 sm:pt-32">
          <Heading
            eyebrow="مبني لطريقة بيعك"
            title="عملاؤك شافوا القطعة في الريلز. الباقي علينا."
            subtitle="أدوات معمولة لبراند ملابس بيبيع من إنستجرام وتيك توك، وكلها شغالة في متجرك من أول يوم."
          />
          <div className="mt-14 grid gap-4 md:grid-cols-2">
            <Feature
              icon={Camera}
              title="البحث بالصورة"
              text="عميلك يرفع سكرين شوت من الريلز أو أي صورة، فيفتح له المتجر القطعة نفسها بسعرها، أو أقرب القطع لها، أو يوصله بواتساب متجرك لو مش موجودة. والقطع اللي اتسألت عليها ومش عندك تشوفها في لوحتك."
            />
            <Feature
              icon={ShieldCheck}
              title="درع الدفع عند الاستلام"
              text="رابط تأكيد يرسله العميل بنفسه قبل الشحن، وتقدير لمخاطرة كل طلب من تاريخه معك (رفض استلام سابق، طلب مكرر، رقم أو عنوان غير مكتمل)، وطلب عربون بضغطة للطلبات المقلقة. القرار دائماً لك."
            />
            <Feature
              icon={MessageCircle}
              title="الطلب يوصلك برقمه على واتساب"
              text="العميل يكمل الطلب في المتجر فيتسجل في لوحتك، وبعدها زر يبعت لك رسالة واتساب جاهزة فيها رقم الطلب وأصنافه والإجمالي. لا طلبات ضايعة في الشات."
            />
            <Feature
              icon={Megaphone}
              title="جاهز لإعلاناتك"
              text="روابط حملات تقيس النقرات والطلبات والمبيعات لكل إعلان، وبكسل ميتا وتيك توك وتحليلات جوجل، وكتالوج منتجات تلقائي لإعلانات ميتا، وصور ستوري وبوست جاهزة بألوان براندك."
            />
          </div>
        </section>

        {/* ─── المميزات ─── */}
        <section id="features" className="container-x scroll-mt-24 py-24 sm:py-32">
          <Heading eyebrow="ما تحصل عليه" title="متجر احترافي ولوحة تحكم كاملة، لا نسخة مبسطة" />
          <div className="mt-14 grid gap-4 md:grid-cols-6">
            <Feature className="md:col-span-3" icon={Palette} title="هوية خاصة بنشاطك" text="لوحة ألوان وخطوط عربية وشكل لكل بطاقة وزر وقسم يختارها فريق التصميم لنشاطك وزبونك." />
            <Feature className="md:col-span-3" icon={PenLine} title="كلام صادق مع عملائك" text="كل شارة ثقة أو سؤال شائع يُفحص مقابل سياستك الحالية عند كل عرض: لو غيّرت الشحن أو الاستبدال يتغير الكلام معه." />
            <Feature className="md:col-span-2" icon={Clapperboard} title="حركة بمستوى تختاره" text="عناوين تتكشف وبطاقات تميل مع المؤشر. تختار المستوى: هادئ أو حيوي أو سينمائي." />
            <Feature className="md:col-span-2" icon={Wallet} title="شراء بسيط" text="العميل يختار متى يدفع: عند الاستلام برسومها الحقيقية، أو مقدماً بفودافون كاش وإنستاباي بالمبلغ المطلوب بالضبط." />
            <Feature className="md:col-span-2" icon={PackageCheck} title="«طلباتي» بلا حسابات" text="كل طلب يُحفظ على جهاز العميل؛ يرى حالته في أي وقت دون تسجيل، ويصله بريد مع كل خطوة إن كتب بريده." />
            <Feature className="md:col-span-3" icon={Ruler} title="مقاسات وألوان ومخزون" text="كل لون بمقاساته وكميته، وصورة لكل لون تظهر لحظة اختياره، والمقاس اللي خلص يظهر مشطوباً ولا يمكن طلبه." />
            <Feature className="md:col-span-3" icon={Palette} title="نطاقك الخاص" text="متجرك يعمل على رابط باسمه من أول يوم، وتقدر تربط دومين براندك (مثل yourbrand.com) من لوحتك، والشهادة الآمنة تُصدر تلقائياً." />
            <Feature className="md:col-span-6" icon={LayoutDashboard} title="لوحة تحكم تدير بها كل شيء" text="منتجات بمقاسات وألوان ومخزون، وطلبات بحالاتها، وعملاء، وأكواد خصم، ومناطق شحن، وفواتير للطباعة برمز تتبع، وتصدير Excel، وإحصاءات زيارات حقيقية." />
          </div>
        </section>

        {/* ─── الملكية ─── */}
        <section id="ownership" className="scroll-mt-24 py-24 sm:py-32">
          <div className="container-x">
            <div className="land-card relative overflow-hidden rounded-[2rem] p-7 sm:p-12">
              <div aria-hidden="true" className="absolute -end-24 -top-24 size-72 rounded-full bg-emerald-400/15 blur-3xl" />
              <div className="relative max-w-2xl space-y-5">
                <Eyebrow>
                  <ShieldCheck className="size-3.5 text-emerald-400" aria-hidden="true" /> بياناتك بيدك دائماً
                </Eyebrow>
                <h2 className="text-3xl font-black leading-tight sm:text-4xl">متجرك وبياناتك ملكك</h2>
                <p className="text-[15px] leading-8 text-[#c3cdf0]/80">
                  نستضيف متجرك ونشغّله ولا تحتاج أي خطوة تقنية. بياناتك (منتجاتك وطلباتك وعملاؤك) ملكك، وتقدر تطلب نسخة منها في أي وقت.
                  ولو تأخرت في التجديد يتوقف متجرك عن الظهور فقط ولا نحذف شيئاً.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── السعر ─── */}
        <section id="pricing" className="container-x scroll-mt-24 py-24 sm:py-32">
          <Heading eyebrow="السعر" title="باقة واحدة. وتجديدها معلن من اليوم الأول." />
          <div className="mx-auto mt-14 grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_1fr]">
            <div className="relative overflow-hidden rounded-[2rem] border border-[#8fa8ff]/30 bg-gradient-to-b from-[#8fa8ff]/12 via-[#0e1430] to-[#0b1026] p-8 shadow-[0_40px_120px_-30px_rgba(111,134,255,0.45)] sm:p-10">
              <p className="text-sm font-bold text-[#c3cdf0]/70">الباقة: متجرك كاملاً + سنة استضافة</p>
              <div className="mt-3 flex items-end gap-3">
                <span className="text-6xl font-black tabular-nums">{fmtEGP(pricing.price)}</span>
                <span className="mb-2 text-lg font-bold text-[#c3cdf0]/70">ج.م</span>
              </div>
              <p className="mt-1 text-[13px] text-[#c3cdf0]/70">
                بناء متجرك + السنة الأولى، ثم {fmtEGP(pricing.renewal)} ج.م لكل سنة بعدها. وبعد تسليم متجرك تجربه {trialHours} ساعة قبل أن تدفع.
              </p>
              <ul className="mt-8 space-y-3 text-[14px]">
                {[
                  "متجر كامل يصممه ويبنيه ويراجعه فريقنا لنشاطك",
                  "لوحة تحكم كاملة بالطلبات والفواتير والإحصاءات",
                  "البحث بالصورة ودرع الدفع عند الاستلام وروابط الحملات",
                  "سنة استضافة وتشغيل كاملة وتحديثات",
                  changesPerMonth ? `${changesLabel(changesPerMonth)} شهرياً ينفذها فريقنا` : "متابعة معك بعد التسليم",
                  "بلا عمولة على مبيعاتك",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4.5 shrink-0 text-emerald-400" aria-hidden="true" /> {b}
                  </li>
                ))}
              </ul>
              <div className="mt-9">
                <Primary label="طلب متجرك الآن" />
              </div>
              <p className="mt-4 text-[11.5px] leading-6 text-[#c3cdf0]/55">
                الدفع بتحويل فودافون كاش أو إنستاباي، ونفعّل متجرك فور مراجعة الإيصال. إن تأخرت في التجديد يتوقف متجرك عن الظهور فقط ويعود فور التجديد، ولا تُحذف بياناتك.
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
                    ["الدفع", "سنوي بسعر معلن", "كل شهر"],
                    ["عمولة المبيعات", "لا يوجد", "غالباً نسبة"],
                    ["التصميم", "مصمم لمتجرك", "قالب مشترك"],
                    ["بياناتك", "ملكك وتطلبها متى شئت", "على المنصة"],
                    ["لو تأخرت في الدفع", "يتوقف دون حذف", "قد تفقد المتجر"],
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
            {faq(trialHours, pricing, changesPerMonth).map(([q, a]) => (
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
            <h2 className="relative text-3xl font-black leading-tight sm:text-5xl">متجرك القادم يبدأ باستمارة من دقيقتين</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-[15px] leading-8 text-[#c3cdf0]/80">
              نبدأ العمل على متجرك، وتتابع كل مرحلة من صفحة طلبك. وتجربة {trialHours} ساعة كاملة قبل أن تدفع أي شيء.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Primary label="طلب متجرك" />
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

function Feature({ icon: Icon, title, text, className }: { icon: typeof Palette; title: string; text: string; className?: string }) {
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

/** «طلب تعديل واحد» / «طلبا تعديل» / «3 طلبات تعديل» / «11 طلب تعديل». */
function changesLabel(n: number): string {
  if (n === 1) return "طلب تعديل واحد";
  if (n === 2) return "طلبا تعديل";
  return `${fmtEGP(n)} ${n <= 10 ? "طلبات" : "طلب"} تعديل`;
}

function faq(h: number, pricing: LandingPricing, changes: number): [string, string][] {
  return [
    ["كم يستغرق تسليم متجري؟", "من 12 ساعة إلى 4 أيام من وقت إرسال الطلب، وقد يطول قليلاً لو عندنا طلبات كثيرة قبلك، وبنقول لك الموعد الفعلي عند الإرسال. وتتابع المرحلة من صفحة طلبك."],
    ["ماذا أحتاج لأطلب متجري؟", "اسم المتجر ووسيلة تواصل، ومنتجات (كلام بسيط عن كل منتج، وصوره اختيارية)، وطرق الدفع والتوصيل. الألوان والشعار وأسئلة الشكل اختيارية أو «يختارها الفريق»."],
    ["هل التجربة مجانية فعلاً؟", `نعم. بعد التسليم تجرّب متجرك ولوحة تحكمه ${h} ساعة بلا بطاقة بنكية. لو لم يعجبك لا تدفع شيئاً.`],
    ["كيف أدفع، ومتى يتفعّل متجري؟", "تحوّل المبلغ بفودافون كاش أو إنستاباي وترفع صورة الإيصال من لوحتك. نراجع الإيصال بأنفسنا ونفعّل متجرك، ويصلك بريد فور التفعيل."],
    ["هل أحتاج خبرة تقنية؟", "لا. نحن نبني متجرك ونستضيفه ونشغّله. وتدير منتجاتك وطلباتك من لوحة تحكم مكتوبة بالعربي وتعمل من الموبايل."],
    ["كم أدفع؟ وماذا بعد السنة الأولى؟", `الباقة ${fmtEGP(pricing.price)} ج.م وتشمل بناء متجرك وسنة استضافة كاملة. من السنة الثانية التجديد ${fmtEGP(pricing.renewal)} ج.م للسنة، تدفعه قبل الانتهاء وتُضاف السنة لنهاية اشتراكك فلا تخسر يوماً. لا عمولة على مبيعاتك أبداً.`],
    ["ماذا لو لم أجدد؟", "بعد انتهاء السنة يبقى متجرك يعمل أسبوعين إضافيين، ثم يتوقف عن الظهور للزوار. لا نحذف أي شيء بسبب التأخر، وبمجرد التجديد يعود متجرك بنفس الرابط. ونذكّرك بالبريد قبل الانتهاء."],
    ["هل أقدر أربط نطاقي الخاص (دومين)؟", "نعم. متجرك يعمل من أول يوم على رابط باسمه مثل اسمك.colapia.com، ومن لوحتك تكتب دومين براندك فتظهر لك السجلات التي تضيفها عند الشركة التي اشتريته منها، ونفعّله والشهادة الآمنة تلقائياً متى أشار إلينا."],
    ["هل أقدر أطلب تعديلات بعد التسليم؟", `نعم.${changes ? ` بعد التفعيل لك ${changesLabel(changes)} كل شهر من لوحتك ينفذها فريقنا،` : " تطلب التعديلات من لوحتك وينفذها فريقنا،"} ومن لوحتك تعدّل المنتجات والأسعار والنصوص والسياسات بنفسك في أي وقت.`],
    ["إيه هو «البحث بالصورة»؟", "زر كاميرا في متجرك: عميلك يرفع سكرين شوت للقطعة اللي شافها في الريلز، فيفتح له المتجر القطعة نفسها أو أقرب القطع لها من منتجاتك. لو مش موجودة يظهر له زر واتساب لمتجرك، وتشوف أنت في لوحتك القطع اللي اتسألت عليها."],
    ["كيف تقلّلون رفض الاستلام؟", "كل طلب دفع عند الاستلام يصل بتقدير لمخاطرته وأسبابه، ومعه رسالة تأكيد جاهزة برابط يؤكد منه العميل طلبه بنفسه، وللطلبات المقلقة رسالة طلب عربون بوسائل التحويل في متجرك. لا نرفض طلباً آلياً: القرار لك."],
    ["هل يحتاج عملائي لإنشاء حساب؟", "لا. العميل يطلب باسمه ورقمه، ويجد طلباته محفوظة على جهازه في «طلباتي» بحالتها الحية، ويصله بريد مع كل خطوة إن كتب بريده."],
  ];
}
