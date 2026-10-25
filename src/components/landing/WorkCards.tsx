// بطاقات الأعمال (Qima ومتجر العرض): لقطة حقيقية متى وُجدت، وإلا بطاقة مصمَّمة بلا ادعاء أنها لقطة.
// تُستخدم في الرئيسية (مختصرة) وصفحة «أعمالنا» (موسّعة بالتفاصيل). لا أرقام ولا تقييمات مخترعة.
import Image from "next/image";
import { ArrowLeft, Check, MessageSquareQuote, ShoppingBag } from "lucide-react";
import { WORKS, type Work } from "@/lib/landing-content";
import { workUrl } from "@/lib/platform-seo";
import { CTA_GHOST } from "./shared";

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function Frame({ work, url, priority }: { work: Work; url: string; priority?: boolean }) {
  return (
    <div className="overflow-hidden rounded-t-[1.4rem] border-b border-white/10">
      <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/5 px-4 py-2.5" aria-hidden="true">
        <span className="size-2.5 rounded-full bg-white/25" />
        <span className="size-2.5 rounded-full bg-white/25" />
        <span className="size-2.5 rounded-full bg-white/25" />
        <span dir="ltr" className="ms-3 truncate rounded-md bg-white/5 px-3 py-0.5 text-[11px] text-[#c3cdf0]/70">
          {hostOf(url)}
        </span>
      </div>
      {work.image ? (
        <Image
          src={work.image.src}
          alt={work.image.alt}
          width={work.image.width}
          height={work.image.height}
          sizes="(min-width: 1024px) 560px, (min-width: 640px) 50vw, 100vw"
          priority={priority}
          className="h-auto w-full"
        />
      ) : (
        <div
          className="relative grid aspect-[8/5] w-full place-items-center bg-gradient-to-br from-[#6f86ff]/25 via-[#0d1230] to-emerald-400/15"
          role="img"
          aria-label={`${work.name}: بطاقة تعريفية`}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="grid size-16 place-items-center rounded-3xl border border-white/15 bg-white/10 text-[#c9d4ff]">
              <ShoppingBag className="size-8" aria-hidden="true" />
            </span>
            <span className="text-xl font-black">{work.name}</span>
            <span className="text-[13px] text-[#c3cdf0]/80">{work.kind}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function WorkCard({ work, origin, detailed, priority }: { work: Work; origin: string; detailed?: boolean; priority?: boolean }) {
  const url = workUrl(origin, work.id);
  return (
    <article className="land-card flex flex-col overflow-hidden rounded-[1.6rem]">
      <Frame work={work} url={url} priority={priority} />
      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
        <p className="text-xs font-semibold text-[#8fa8ff]">{work.kind}</p>
        <h3 className="text-xl font-black">{work.name}</h3>
        <p className="text-[14px] leading-7 text-[#c3cdf0]/80">{work.summary}</p>
        {detailed ? (
          <ul className="space-y-2 text-[13.5px] leading-7 text-[#c3cdf0]/80">
            {work.details.map((d) => (
              <li key={d} className="flex items-start gap-2">
                <Check className="mt-1.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" /> {d}
              </li>
            ))}
          </ul>
        ) : null}
        {work.clientNote ? (
          <p className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-[13px] leading-7 text-[#c3cdf0]/85">
            <MessageSquareQuote className="mt-1 size-4 shrink-0 text-[#8fa8ff]" aria-hidden="true" />
            <span>
              <b className="font-black">رضا العميل: </b>
              {work.clientNote}
            </span>
          </p>
        ) : null}
        <div className="mt-auto pt-2">
          <a href={url} target="_blank" rel="noopener noreferrer" className={`${CTA_GHOST} !px-5 !py-3 !text-sm`}>
            {work.cta} <ArrowLeft className="size-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  );
}

export function WorkGrid({ origin, detailed, priorityFirst }: { origin: string; detailed?: boolean; priorityFirst?: boolean }) {
  return (
    <div className="mt-12 grid gap-6 md:grid-cols-2">
      {WORKS.map((w, i) => (
        <WorkCard key={w.id} work={w} origin={origin} detailed={detailed} priority={priorityFirst && i === 0} />
      ))}
    </div>
  );
}
