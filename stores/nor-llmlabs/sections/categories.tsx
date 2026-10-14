// الأقسام: لوحتان تحريريتان كبيرتان (فساتين، رجالي) بدل دوائر صغيرة. الغلاف = أعلى قطعة سعراً في القسم (القطعة
// الأبرز)، ومعه عدد القطع وأقل سعر فيه، كلها من بيانات المتجر الحية: أي منتج أو قسم يضيفه التاجر يظهر وحده.
import Image from "next/image";
import Link from "next/link";
import { SectionShell, SectionHeading, Icon, formatEgp, type SectionProps, type KitCategory, type KitProduct } from "@/stores-kit";

const pieces = (n: number) => (n === 1 ? "قطعة واحدة" : n === 2 ? "قطعتان" : n <= 10 ? `${n} قطع` : `${n} قطعة`);

type Tile = { cat: KitCategory; cover: string | null; alt: string; from: number | null };

export default async function NoorCategories({ s, kit, core }: SectionProps<"categories">) {
  const cats = await kit.data.categories(s.categorySlugs.length ? s.categorySlugs : undefined);
  const visible = cats.filter((c) => c.productCount > 0).slice(0, 4);
  if (!visible.length) return core;

  const tiles: Tile[] = await Promise.all(
    visible.map(async (cat) => {
      const items: KitProduct[] = await kit.data.products({ source: { type: "category", slug: cat.slug }, limit: 24 });
      const top = [...items].sort((a, b) => b.pricePiasters - a.pricePiasters).find((p) => p.images[0]?.url);
      const prices = items.map((p) => p.pricePiasters).filter((n) => n > 0);
      return { cat, cover: top?.images[0]?.url ?? cat.image, alt: top ? top.name : cat.name, from: prices.length ? Math.min(...prices) : null };
    })
  );

  return (
    <SectionShell s={s} hook="noor-cats">
      <SectionHeading title={s.title} subtitle={s.subtitle} />
      <ul className={`noor-cats-grid mt-8 grid gap-3 sm:gap-5 ${tiles.length === 1 ? "grid-cols-1" : tiles.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}>
        {tiles.map((t, i) => (
          <li key={t.cat.id}>
            <Link href={`/c/${encodeURIComponent(t.cat.slug)}`} className="noor-tile group relative block overflow-hidden">
              {t.cover ? (
                <Image
                  src={t.cover}
                  alt={t.alt}
                  fill
                  sizes="(max-width: 640px) 50vw, 45vw"
                  priority={i === 0}
                  className="noor-tile-img object-cover"
                />
              ) : null}
              <span aria-hidden="true" className="noor-tile-shade absolute inset-0" />
              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 sm:p-6">
                <span className="min-w-0">
                  <span className="noor-tile-name block font-heading">{t.cat.name}</span>
                  <span className="noor-tile-meta mt-1 flex flex-wrap gap-x-2">
                    <span>{pieces(t.cat.productCount)}</span>
                    {t.from ? <span className="whitespace-nowrap">من {formatEgp(t.from)}</span> : null}
                  </span>
                </span>
                <span className="noor-tile-go grid shrink-0 place-items-center" aria-hidden="true">
                  <Icon name="arrow-left" size={18} />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
