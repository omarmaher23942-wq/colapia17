"use client";

import { Star } from "lucide-react";
import { SectionHeading } from "./shared";
import type { LandingReview } from "./types";

export function TestimonialsSection({ reviews }: { reviews: LandingReview[] }) {
  // عدم إظهار القسم نهائياً في صفحة الهبوط إلا عند وجود تقييمين معتمدين على الأقل
  if (!reviews || reviews.length < 2) {
    return null;
  }

  return (
    <section className="container-x py-20 sm:py-28" dir="rtl">
      <SectionHeading
        eyebrow="آراء حقيقية"
        title="ماذا يقول تجّارنا"
        subtitle="تجارب موثّقة من تجار حقيقيين يعتمدون على Colapia يومياً."
      />

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((r) => (
          <figure
            key={r.id}
            className="flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-xl backdrop-blur-xl transition-all hover:border-[#8fa8ff]/30"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-1 text-amber-400" aria-label={`تقييم ${r.rating} من 5`}>
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Star
                    key={idx}
                    className={`size-4 ${idx < r.rating ? "fill-current" : "opacity-20"}`}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <blockquote className="text-sm leading-relaxed text-[#eaf0ff]">
                "{r.content}"
              </blockquote>
            </div>

            <figcaption className="flex items-center gap-3 border-t border-white/5 pt-4">
              {r.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.avatarUrl}
                  alt={r.authorName}
                  className="size-11 rounded-full border border-white/10 object-cover"
                />
              ) : (
                <div className="flex size-11 items-center justify-center rounded-full bg-[#6f86ff]/20 font-bold text-[#8fa8ff]">
                  {r.authorName.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{r.authorName}</p>
                <p className="truncate text-xs text-[#8d97c4]">
                  {r.authorRole || "صاحب المتجر"} · {r.storeName}
                </p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}