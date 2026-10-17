// Hero — واجهة المتجر (Core): ثلاثة تخطيطات فقط، تُختار من محتواها:
//   video: فيديو خلفية بملء العرض مع صورة غلاف تُرسم فوراً (شروط الأداء في HeroVideo)
//   split: نص وصورة متوسطة الحجم على جانب (النص أولاً على الموبايل)، وحتى 5 صور متبدلة
//   product_spotlight: منتج بطل تلقائي من المتجر حين لا توجد وسائط (وإلا واجهة نصية نظيفة)
// بلا حركات استعراضية؛ العنوان والأزرار تظهر فوراً من الخادم.
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { hrefFor } from "@/lib/links";
import { formatEgp } from "@/lib/money";
import { cn } from "@/lib/utils";
import { coreHeroVariant } from "@/blueprint/core-migrate";
import type { HeroSection } from "@/blueprint/schema";
import { HeroVideo } from "./HeroVideo";
import { HeroSlides } from "./HeroSlides";

export type HeroSpotlight = { slug: string; name: string; pricePiasters: number; compareAtPiasters: number | null; image?: string } | null;

function Ctas({ s, light }: { s: HeroSection; light?: boolean }) {
  if (!s.primaryCta && !s.secondaryCta) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      {s.primaryCta ? (
        <Link href={hrefFor(s.primaryCta.target)} className="s-btn min-w-40 !min-h-12 text-[15px]">
          {s.primaryCta.label}
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
      {s.secondaryCta ? (
        <Link href={hrefFor(s.secondaryCta.target)} className={cn("s-btn-ghost !min-h-12 text-[15px]", light && "!border-white/60 !text-white hover:!bg-white/10")}>
          {s.secondaryCta.label}
        </Link>
      ) : null}
    </div>
  );
}

function Copy({ s, light, center }: { s: HeroSection; light?: boolean; center?: boolean }) {
  return (
    <div className={cn("s-copy flex flex-col gap-4", center && "items-center text-center")}>
      {s.eyebrow ? <span className={cn("s-eyebrow", light && "!text-white/90")}>{s.eyebrow}</span> : null}
      <h1 className={cn("s-display font-heading", light && "!text-white")}>{s.headline}</h1>
      {s.subheadline ? <p className={cn("s-sub max-w-xl !text-base sm:!text-lg", center && "mx-auto", light && "!text-white !opacity-90")}>{s.subheadline}</p> : null}
      <Ctas s={s} light={light} />
    </div>
  );
}

export function Hero({ s, spotlight = null }: { s: HeroSection; spotlight?: HeroSpotlight }) {
  const imgs = s.images;
  let layout = coreHeroVariant(s);
  // منتج بطل بلا منتج: صور المتجر إن وُجدت وإلا واجهة نصية.
  if (layout === "product_spotlight" && !spotlight?.image) layout = imgs.length ? "split" : "product_spotlight";
  const pos = (i: number) => `${Math.round((imgs[i]?.focalX ?? 0.5) * 100)}% ${Math.round((imgs[i]?.focalY ?? 0.5) * 100)}%`;

  if (layout === "video") {
    const poster = imgs[0];
    return (
      <section className="s-hero relative isolate flex min-h-[78svh] items-end overflow-hidden" data-layout="video">
        {poster ? <Image src={poster.url} alt="" fill priority sizes="100vw" className="-z-10 object-cover" style={{ objectPosition: pos(0) }} /> : <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ background: "linear-gradient(160deg, var(--primary), color-mix(in srgb, var(--primary) 40%, black))" }} />}
        {s.videoUrl ? <HeroVideo src={s.videoUrl} className="-z-10" /> : null}
        <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ background: `linear-gradient(to top, rgb(0 0 0 / ${Math.max(0.35, s.overlayOpacity) + 0.25}), rgb(0 0 0 / ${s.overlayOpacity * 0.6}) 55%, transparent)` }} />
        <div className="container-x w-full pb-[clamp(2.5rem,8vw,6rem)] pt-32">
          <div className="max-w-2xl">
            <Copy s={s} light />
          </div>
        </div>
      </section>
    );
  }

  if (layout === "split") {
    return (
      <section className="s-hero" data-layout="split">
        <div className="container-x grid items-center gap-8 py-[clamp(2.5rem,6vw,5.5rem)] md:grid-cols-2 md:gap-14">
          <div className="order-1">
            <Copy s={s} />
          </div>
          <div className="order-2 mx-auto w-full max-w-lg md:max-w-none">
            <HeroSlides images={imgs} fallbackAlt={s.headline} autoplayMs={s.autoplayMs} />
          </div>
        </div>
      </section>
    );
  }

  if (spotlight?.image) {
    const href = `/p/${encodeURIComponent(spotlight.slug)}`;
    return (
      <section className="s-hero relative isolate overflow-hidden" data-layout="product_spotlight">
        <div aria-hidden="true" className="absolute inset-y-0 end-0 -z-10 w-full md:w-1/2" style={{ background: "linear-gradient(160deg, color-mix(in srgb, var(--primary) 14%, var(--background)), color-mix(in srgb, var(--accent) 10%, var(--background)))" }} />
        <div className="container-x grid items-center gap-8 py-[clamp(2.5rem,6vw,5.5rem)] md:grid-cols-2 md:gap-14">
          <Copy s={s} />
          <Link href={href} className="group relative mx-auto block w-full max-w-md focus-visible:outline-none">
            <div className="s-hero-media s-media relative !aspect-[4/5]">
              <Image src={spotlight.image} alt={spotlight.name} fill priority sizes="(max-width: 768px) 90vw, 40vw" className="!static object-cover" />
            </div>
            <div className="s-card absolute -bottom-5 start-4 end-4 flex items-center justify-between gap-3 p-3.5 sm:start-6 sm:end-auto sm:min-w-64">
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">{spotlight.name}</span>
                <span className="s-price mt-0.5 inline-block text-sm">{formatEgp(spotlight.pricePiasters)}</span>
              </span>
              <span className="s-btn !size-11 !min-h-0 !rounded-full !p-0" aria-hidden="true">
                <ArrowLeft className="size-4" />
              </span>
            </div>
          </Link>
        </div>
      </section>
    );
  }

  // لا وسائط ولا منتجات بعد: واجهة نصية نظيفة بلا زخرفة.
  return (
    <section className="s-hero" data-layout="text">
      <div className="container-x py-[clamp(3.5rem,10vw,7rem)]">
        <div className="mx-auto max-w-3xl">
          <Copy s={s} center />
        </div>
      </div>
    </section>
  );
}
