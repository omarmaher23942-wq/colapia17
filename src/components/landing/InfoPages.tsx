// صفحتا «من نحن» و«أعمالنا»: قصيرتان وصادقتان، تعرّفان بالكيان بالاسم نفسه (Colapia | كولابيا) وتدعمان ظهوره في البحث.
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { ABOUT, DEFINITION, SERVICES, STEPS } from "@/lib/landing-content";
import { Ctas } from "./Ctas";
import { LandingShell } from "./LandingShell";
import { WorkGrid } from "./WorkCards";
import { CTA_GHOST, Heading } from "./shared";
import type { SessionState } from "./types";

export function AboutPage({ session }: { session: SessionState }) {
  return (
    <LandingShell session={session}>
      <article className="container-x max-w-4xl py-12 sm:py-20">
        <Heading as="h1" eyebrow="من نحن" title="Colapia | كولابيا" subtitle={ABOUT.lead} />

        <section aria-labelledby="about-what" className="mt-16">
          <h2 id="about-what" className="text-2xl font-black">
            ماذا نفعل؟
          </h2>
          <p className="mt-3 text-[15px] leading-8 text-[#c3cdf0]/85">{DEFINITION}</p>
          <ul className="mt-5 space-y-3">
            {ABOUT.what.map((w) => (
              <li key={w} className="flex items-start gap-3 text-[15px] leading-8">
                <Check className="mt-2 size-4 shrink-0 text-emerald-400" aria-hidden="true" /> {w}
              </li>
            ))}
          </ul>
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="مجالات عملنا">
            {SERVICES.map((s) => (
              <li key={s.id} className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[13px] text-[#c3cdf0]/85">
                {s.title}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="about-how" className="mt-16">
          <h2 id="about-how" className="text-2xl font-black">
            كيف نعمل؟
          </h2>
          <ol className="mt-5 space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="land-card rounded-2xl p-5">
                <h3 className="text-[16px] font-black">
                  <span className="text-[#8fa8ff]">{i + 1}.</span> {s.title}
                </h3>
                <p className="mt-1.5 text-[14px] leading-7 text-[#c3cdf0]/80">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="about-values" className="mt-16">
          <h2 id="about-values" className="text-2xl font-black">
            ما نلتزم به
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {ABOUT.values.map((v) => (
              <div key={v.title} className="land-card rounded-2xl p-5">
                <h3 className="text-[16px] font-black">{v.title}</h3>
                <p className="mt-1.5 text-[14px] leading-7 text-[#c3cdf0]/80">{v.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="about-contact" className="mt-16 text-center">
          <h2 id="about-contact" className="text-2xl font-black">
            تحدثوا معنا
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-8 text-[#c3cdf0]/85">اشرحوا لنا فكرتكم على إنستجرام، ونتفق معكم على ما سنبنيه وموعد تسليمه.</p>
          <Ctas session={session} className="mt-6 justify-center" />
        </section>
      </article>
    </LandingShell>
  );
}

export function WorkPage({ session, origin }: { session: SessionState; origin: string }) {
  return (
    <LandingShell session={session}>
      <div className="container-x py-12 sm:py-20">
        <Heading as="h1" eyebrow="أعمالنا" title="مشاريع نفّذناها ويمكنكم زيارتها" subtitle="نعرض هنا ما هو موجود فعلاً: موقع يعمل لعميل، ومتجر تجريبي كامل لتجربوا ما نبنيه." />
        <WorkGrid origin={origin} detailed priorityFirst />
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-black">لديكم فكرة؟</h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-8 text-[#c3cdf0]/85">راسلونا ونبدأ بمحادثة قصيرة نتفق فيها على ما تحتاجونه.</p>
          <Ctas session={session} className="mt-6 justify-center" />
          <div className="mt-6">
            <Link href="/" className={`${CTA_GHOST} !px-5 !py-3 !text-sm`}>
              الرجوع إلى الرئيسية <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </LandingShell>
  );
}
