// PromoBanner — بانرات خصم بشبكة 2 أعمدة + زر نسخ الكود.
import Image from "next/image";
import { Tag, Percent } from "lucide-react";
import { z } from "zod";
import { SectionShell } from "@/components/storefront/SectionShell";
import { CopyCode } from "@/components/storefront/CopyCode";
import { Cta } from "./_shared";
import type * as S from "@/blueprint/schema";

type PromoBannerSection = z.infer<typeof S.promoBannerSection>;

export function PromoBanner({ s }: { s: PromoBannerSection }) {
  const items = s.items ?? [];
  if (items.length === 0) return null;

  return (
    <SectionShell s={s}>
      <div className={items.length >= 3 ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-4 sm:grid-cols-2"} dir="rtl">
        {items.map((it, i) => (
          <article
            key={i}
            className="flex flex-col gap-3 overflow-hidden rounded-3xl border shadow-xs"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
              color: "var(--card-foreground)",
            }}
          >
            {it.image ? (
              <div className="relative aspect-[16/10] w-full">
                <Image src={it.image.url} alt={it.image.alt || it.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover" style={{ objectPosition: `${Math.round((it.image.focalX ?? 0.5) * 100)}% ${Math.round((it.image.focalY ?? 0.4) * 100)}%` }} />
              </div>
            ) : null}
            <div className="flex flex-1 flex-col gap-3 p-6 sm:p-8">
            {it.eyebrow || it.couponCode || !it.image ? (
            <span
              className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-black"
              style={{
                background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
                color: "var(--primary)",
              }}
            >
              <Percent className="size-3" strokeWidth={2.5} aria-hidden="true" />
              {it.eyebrow || (it.couponCode ? "كود خصم" : "عرض")}
            </span>
            ) : null}
            <h3 className="font-black font-heading text-lg sm:text-xl">
              {it.title}
            </h3>
            {it.text ? (
              <p className="text-xs leading-relaxed opacity-80">{it.text}</p>
            ) : null}
            {it.couponCode ? (
              <div className="pt-1">
                <CopyCode code={it.couponCode} />
              </div>
            ) : null}
            {it.cta ? (
              <div className="mt-auto pt-1">
                <Cta cta={{ ...it.cta, style: "secondary" }} />
              </div>
            ) : !it.couponCode && !it.image ? (
              <Tag className="size-4 opacity-30" strokeWidth={1.75} aria-hidden="true" />
            ) : null}
            </div>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}