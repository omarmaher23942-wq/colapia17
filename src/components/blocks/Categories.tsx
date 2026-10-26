// Categories.tsx — أقسام المتجر بتصميمين فقط:
//  - circles: دوائر بصور الأقسام، بتمرير أفقي بالالتقاط (snap) على الموبايل وشبكة متمركزة على الحاسوب.
//  - tiles: بلاطات بصور (عمودان على الموبايل، 3 ثم 4 على الشاشات الأكبر).
// الأقسام الفارغة تُستبعد قبل الوصول هنا (registry). كل الألوان من توكنات المتجر.
import Link from "next/link";
import Image from "next/image";
import { SectionShell, SectionHeading } from "@/components/storefront/SectionShell";
import { arCount, NOUN } from "@/lib/format";
import { coreCategoriesVariant } from "@/blueprint/core-migrate";
import type { CategoriesSection } from "@/blueprint/schema";

type Cat = { id: string; name: string; slug: string; productCount?: number; firstProductImage?: string | null };

export function Categories({ s, categories }: { s: CategoriesSection; categories: Cat[] }) {
  const list = categories.filter((c) => (c.productCount ?? 1) > 0).slice(0, 12);
  if (!list.length) return null;
  const variant = coreCategoriesVariant(s.variant ?? "circles");
  const count = (c: Cat) => (s.showProductCount && c.productCount ? arCount(c.productCount, NOUN.product) : null);

  return (
    <SectionShell s={s}>
      <SectionHeading title={s.title ?? "تسوقوا حسب القسم"} subtitle={s.subtitle} sectionId={s.id} />
      {variant === "circles" ? (
        <ul className="hide-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 sm:gap-6">
          {list.map((c) => (
            <li key={c.id} className="w-24 shrink-0 snap-start sm:w-32">
              <Link href={`/c/${encodeURIComponent(c.slug)}`} className="group flex flex-col items-center gap-2 text-center focus-visible:outline-none">
                <span className="relative block size-24 overflow-hidden rounded-full border-2 transition group-hover:scale-[1.03] group-focus-visible:ring-2 sm:size-32" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                  {c.firstProductImage ? <Image src={c.firstProductImage} alt="" fill sizes="128px" className="object-cover" /> : <span className="grid size-full place-items-center text-2xl font-black opacity-40">{Array.from(c.name)[0]}</span>}
                </span>
                <span className="line-clamp-2 text-[13px] font-bold leading-snug sm:text-sm">{c.name}</span>
                {count(c) ? <span className="-mt-1 text-[12px] opacity-65">{count(c)}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {list.map((c) => (
            <li key={c.id}>
              <Link href={`/c/${encodeURIComponent(c.slug)}`} className="s-card group relative block aspect-[4/5] overflow-hidden focus-visible:outline-none focus-visible:ring-2">
                {c.firstProductImage ? <Image src={c.firstProductImage} alt="" fill sizes="(max-width:640px) 50vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-105" /> : <span className="absolute inset-0" style={{ background: "var(--muted)" }} />}
                <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 p-3.5 text-white">
                  <span className="block text-sm font-black leading-snug sm:text-base">{c.name}</span>
                  {count(c) ? <span className="text-[12px] opacity-90">{count(c)}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}
