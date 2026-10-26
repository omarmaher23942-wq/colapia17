// واجهة تحريرية: نص ثم قوسان بصورتين وبطاقة قطعة مختارة. الحقائق من سياسة المتجر الفعلية، والصورة الأولى أولوية تحميل.
import Image from "next/image";
import Link from "next/link";
import { Cta, Icon, Price, type SectionProps } from "@/stores-kit";

export default async function DemoHero({ s, kit }: SectionProps<"hero">) {
  const [a, b] = s.images;
  const spot = s.spotlightProductSlug ? await kit.data.product(s.spotlightProductSlug) : null;
  const facts = kit.facts.filter((f) => ["cod", "inspection", "returns", "nationwide", "free_shipping_over"].includes(f.key)).slice(0, 3);
  return (
    <section className="dm-hero" data-demo-section="hero">
      <div className="container-x dm-hero-grid">
        <div>
          {s.eyebrow ? <p className="dm-eyebrow">{s.eyebrow}</p> : null}
          <h1 className="dm-hero-title">{s.headline}</h1>
          {s.subheadline ? <p className="dm-lead">{s.subheadline}</p> : null}
          <div className="dm-cta-row">
            {s.primaryCta ? <Cta cta={{ ...s.primaryCta, style: "primary" }} lg /> : null}
            {s.secondaryCta ? <Cta cta={{ ...s.secondaryCta, style: "secondary" }} lg /> : null}
          </div>
          {facts.length ? (
            <ul className="dm-facts">
              {facts.map((f) => (
                <li key={f.key}>
                  <Icon name={f.icon} size={16} />
                  {f.title}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="dm-hero-art">
          {a ? (
            <div className="dm-arch dm-arch-main">
              <Image src={a.url} alt={a.alt ?? ""} fill priority sizes="(min-width:1024px) 480px, 80vw" />
            </div>
          ) : null}
          {b ? (
            <div className="dm-arch dm-arch-second">
              <Image src={b.url} alt={b.alt ?? ""} fill sizes="(min-width:1024px) 200px, 34vw" />
            </div>
          ) : null}
          {spot ? (
            <Link href={`/p/${encodeURIComponent(spot.slug)}`} className="dm-spot">
              <span>
                <strong>{spot.name}</strong>
                <Price price={spot.pricePiasters} compareAt={spot.compareAtPiasters} size="sm" showSavings={false} />
              </span>
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
