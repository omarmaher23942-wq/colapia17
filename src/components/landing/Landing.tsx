// الصفحة الرئيسية لوكالة Colapia — تُرسم على الخادم بالكامل. كل جملة هنا صحيحة عن الوكالة اليوم.
// الترتيب: واجهة بتعريف مباشر ← ما نبنيه ← كيف نعمل ← أعمالنا ← لماذا Colapia ← الأسئلة ← دعوة ختامية.
// النصوص كلها من lib/landing-content.ts (مصدر واحد مشترك مع البيانات المنظمة وllms.txt).
import Link from "next/link";
import {
  AppWindow,
  Bot,
  Wrench,
  ArrowLeft,
  CalendarCheck,
  Check,
  Code2,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  Store,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { DEFINITION, SERVICES, STEPS, WHY, WORKING_PRINCIPLES, WORKS, type ServiceId, type WhyId } from "@/lib/landing-content";
import { Ctas } from "./Ctas";
import { Faq } from "./Faq";
import { LandingShell } from "./LandingShell";
import { WorkCard } from "./WorkCards";
import { CTA_GHOST, Eyebrow, Heading } from "./shared";
import type { SessionState } from "./types";

const SERVICE_ICON: Record<ServiceId, LucideIcon> = {
  stores: Store,
  sites: Globe,
  booking: CalendarCheck,
  dashboards: LayoutDashboard,
  webapps: AppWindow,
  landing: Megaphone,
  agents: Bot,
  custom: Wrench,
};

const WHY_ICON: Record<WhyId, LucideIcon> = { ownership: KeyRound, clarity: Check, fit: Wrench, support: LifeBuoy };
const STEP_ICON: LucideIcon[] = [MessageCircle, Code2, KeyRound];

export function Landing({ session, origin }: { session: SessionState; origin: string }) {
  return (
    <LandingShell session={session}>
      {/* ─── الواجهة: تعريف مباشر بإجابة أولاً ─── */}
      <section className="container-x grid items-center gap-10 pb-16 pt-6 sm:pt-12 lg:grid-cols-[1.15fr_1fr] lg:gap-12 lg:pb-24">
        <div className="land-rise flex flex-col items-start gap-6">
          <Eyebrow>Colapia · كولابيا — وكالة تصميم وبرمجة</Eyebrow>
          <h1 className="text-[2.25rem] font-black leading-[1.15] tracking-tight sm:text-5xl lg:text-[3.5rem]">
            أي نظام يحتاجه نشاطكم
            <br />
            <span className="land-gradient-text">نبنيه ونسلّمه لكم</span> بكوده وملكيته
          </h1>
          <p className="max-w-xl text-base leading-8 text-[#c3cdf0]/85 sm:text-lg">{DEFINITION}</p>
          <Ctas session={session} />
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-bold text-[#c3cdf0]/80" aria-label="ما يميزنا">
            {WORKING_PRINCIPLES.map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="size-4 text-emerald-400" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="land-rise min-w-0">
          <p className="mb-3 text-center text-xs font-bold text-[#8fa8ff] sm:text-sm">مثال حقيقي من أعمالنا</p>
          <WorkCard work={WORKS[0]!} origin={origin} priority />
        </div>
      </section>

      {/* ─── ما نبنيه ─── */}
      <section id="services" className="container-x scroll-mt-24 py-20 sm:py-28">
        <Heading eyebrow="الخدمات" title="ما الذي نبنيه لكم؟" subtitle="حلول ويب كاملة لمختلف الأنشطة، تُصمَّم لتناسب ما تحتاجونه فعلاً." />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => {
            const Icon = SERVICE_ICON[s.id];
            return (
              <article key={s.id} className="land-card land-spot group relative flex flex-col overflow-hidden rounded-3xl p-6">
                <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#6f86ff]/30 to-emerald-400/10 text-[#c9d4ff] transition group-hover:scale-110">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-[17px] font-black">{s.title}</h3>
                <p className="mt-2 text-[14px] leading-7 text-[#c3cdf0]/80">{s.definition}</p>
                <p className="mt-4 border-t border-white/10 pt-4 text-[13px] leading-7 text-[#c3cdf0]/75">
                  <b className="font-black text-[#8fa8ff]">مثال: </b>
                  {s.example}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {/* ─── كيف نعمل ─── */}
      <section id="process" className="scroll-mt-24 border-y border-white/5 bg-gradient-to-b from-transparent via-[#0b1030]/60 to-transparent py-20 sm:py-28">
        <div className="container-x">
          <Heading eyebrow="كيف نعمل" title="من الفكرة إلى نظام يعمل باسمكم" />
          <ol className="mt-14 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => {
              const Icon = STEP_ICON[i] ?? Code2;
              return (
                <li key={s.title} className="land-card relative flex flex-col gap-3 rounded-3xl p-6 sm:p-7">
                  <span className="flex items-center justify-between">
                    <span className="grid size-11 place-items-center rounded-2xl bg-[#6f86ff]/15 text-[#8fa8ff]">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="font-mono text-3xl font-black text-white/10" aria-hidden="true">
                      0{i + 1}
                    </span>
                  </span>
                  <h3 className="text-lg font-black">{s.title}</h3>
                  <p className="text-[14px] leading-7 text-[#c3cdf0]/80">{s.text}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ─── أعمالنا ─── */}
      <section id="work" className="container-x scroll-mt-24 py-20 sm:py-28">
        <Heading eyebrow="متجر توضيحي" title="استكشفوا تجربة متجر إلكتروني" subtitle="هذا الديمو مستقل للتوضيح، وليس مشروع عميل أو معاينة لطلب خاص. شاهدوا التفاصيل في صفحة أعمالنا." />
        <div className="mx-auto mt-12 max-w-2xl">
          <WorkCard work={WORKS[1]!} origin={origin} />
        </div>
        <div className="mt-8 flex justify-center">
          <Link href="/work" className={CTA_GHOST}>
            جميع الأعمال والتفاصيل <ArrowLeft className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* ─── لماذا Colapia ─── */}
      <section id="why" className="container-x scroll-mt-24 pb-20 sm:pb-28">
        <Heading eyebrow="لماذا Colapia" title="ما الذي يميّز التعامل معنا؟" />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map((w) => {
            const Icon = WHY_ICON[w.id];
            return (
              <article key={w.id} className="land-card land-spot group relative overflow-hidden rounded-3xl p-5 sm:p-6">
                <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#6f86ff]/30 to-emerald-400/10 text-[#c9d4ff] transition group-hover:scale-110">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-[16px] font-black">{w.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-7 text-[#c3cdf0]/80">{w.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* ─── الأسئلة ─── */}
      <section id="faq" className="container-x scroll-mt-24 pb-20 sm:pb-28">
        <Heading eyebrow="الأسئلة الشائعة" title="إجابات سريعة قبل أن تبدأوا" />
        <Faq />
      </section>

      {/* ─── الختام ─── */}
      <section className="container-x pb-28">
        <div className="relative overflow-hidden rounded-[2.2rem] border border-white/10 bg-gradient-to-l from-[#6f86ff]/25 via-[#0d1230] to-emerald-400/10 px-6 py-14 text-center sm:px-12 sm:py-20">
          <div aria-hidden="true" className="land-orb absolute -bottom-24 start-1/2 size-80 -translate-x-1/2 rounded-full bg-[#6f86ff]/30 blur-3xl rtl:translate-x-1/2" />
          <h2 className="relative text-3xl font-black leading-tight sm:text-5xl">ابدأوا بمحادثة قصيرة</h2>
          <p className="relative mx-auto mt-4 max-w-md text-[15px] leading-8 text-[#c3cdf0]/85">اشرحوا لنا فكرتكم، ونتفق على ما سنبنيه وموعد تسليمه قبل أن نبدأ.</p>
          <Ctas session={session} className="relative mt-8 justify-center" />
        </div>
      </section>
    </LandingShell>
  );
}
