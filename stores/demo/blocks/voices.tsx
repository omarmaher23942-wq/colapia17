// آراء من التقييمات: تقرأ صفوف التقييمات في المتجر وحدها (لا نصوص مكتوبة هنا)، مع تصريح دائم بأنها توضيحية.
import { SectionShell, type BlockProps } from "@/stores-kit";

const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

export default async function Voices({ s, props, kit }: BlockProps<{ limit?: number }>) {
  const all = await kit.data.reviews(24);
  const five = all.filter((r) => r.rating === 5).sort((a, b) => b.text.length - a.text.length);
  const four = all.filter((r) => r.rating === 4);
  const limit = Math.min(Math.max(props.limit ?? 6, 3), 6);
  const picked = [...five.slice(0, Math.max(limit - 2, 1)), ...four.slice(0, 2)].slice(0, limit);
  if (picked.length < 3) return null;
  return (
    <SectionShell s={s}>
      <div className="dm-head">
        <p className="dm-eyebrow">التقييمات</p>
        <h2 className="dm-title">{s.title ?? "آراء من التقييمات"}</h2>
        <p className="dm-lead">تقييمات توضيحية لمتجر العرض، وليست من طلبات حقيقية.</p>
      </div>
      <div className="dm-voices" data-demo-block="voices">
        {picked.map((r, i) => (
          <figure key={`${r.name}-${i}`} className={i === 0 ? "dm-quote is-lead" : "dm-quote"}>
            <span className="dm-stars" role="img" aria-label={`${r.rating} من 5`}>{stars(r.rating)}</span>
            <blockquote><p>{r.text}</p></blockquote>
            <figcaption className="text-sm font-bold">{r.name}</figcaption>
          </figure>
        ))}
      </div>
    </SectionShell>
  );
}
