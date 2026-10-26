// اعرفوا مقاسكم: أداة تقترح المقاس من الطول والوزن بناءً على جدول مقاسات المتجر نفسه (لا جدول مخترع).
import Link from "next/link";
import { SectionShell, type BlockProps } from "@/stores-kit";
import FitFinderForm from "../components/FitFinderForm";

export default async function FitFinder({ s, props, kit }: BlockProps<{ category?: string }>) {
  const chart = kit.bp.sizeGuide.charts.find((c) => c.rows.some((r) => r.heightFrom != null && r.weightFrom != null));
  if (!chart) return null;
  const rows = chart.rows.map((r) => ({
    size: r.size,
    h: r.heightFrom != null && r.heightTo != null ? ([r.heightFrom, r.heightTo] as [number, number]) : null,
    w: r.weightFrom != null && r.weightTo != null ? ([r.weightFrom, r.weightTo] as [number, number]) : null,
  }));
  const cats = await kit.data.categories();
  const cat = cats.find((c) => c.name === props.category);
  return (
    <SectionShell s={s}>
      <div className="dm-fit" data-demo-block="fit-finder">
        <div>
          <p className="dm-eyebrow">المقاس</p>
          <h2 className="dm-title">{s.title ?? "اعرفوا مقاسكم"}</h2>
          <p className="dm-lead mt-3">أدخلوا الطول والوزن ليظهر المقاس الأقرب في جدول «{chart.name}». الاقتراح استرشادي، وجدول القياسات الكامل في صفحة كل قطعة.</p>
          {cat ? (
            <Link href={`/c/${encodeURIComponent(cat.slug)}`} className="dm-link mt-4">
              تسوقوا {cat.name}
            </Link>
          ) : null}
        </div>
        <FitFinderForm rows={rows} />
      </div>
    </SectionShell>
  );
}
