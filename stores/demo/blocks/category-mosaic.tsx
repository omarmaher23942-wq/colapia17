// فسيفساء الأقسام: القسم الأول كبير والأخير عريض، بأغلفة فوتوغرافية متى وُجدت وإلا صورة أول منتج في القسم.
import Image from "next/image";
import Link from "next/link";
import { SectionShell, type BlockProps } from "@/stores-kit";

type Props = { covers?: Record<string, string>; order?: string[] };

export default async function CategoryMosaic({ s, props, kit }: BlockProps<Props>) {
  const all = (await kit.data.categories()).filter((c) => c.productCount > 0);
  const order = props.order ?? [];
  const rank = (n: string) => (order.indexOf(n) < 0 ? order.length : order.indexOf(n));
  const cats = [...all].sort((a, b) => rank(a.name) - rank(b.name)).slice(0, 6);
  if (cats.length < 2) return null;
  return (
    <SectionShell s={s}>
      <div className="dm-head">
        <p className="dm-eyebrow">الأقسام</p>
        <h2 className="dm-title">{s.title ?? "تسوقوا حسب القسم"}</h2>
      </div>
      <div className="dm-mosaic" data-demo-block="category-mosaic">
        {cats.map((c, i) => {
          const src = props.covers?.[c.name] ?? c.image;
          return (
            <Link key={c.id} href={`/c/${encodeURIComponent(c.slug)}`} className="dm-tile">
              {src ? <Image src={src} alt="" fill sizes={i === 0 ? "(min-width:900px) 50vw, 100vw" : "(min-width:900px) 25vw, 50vw"} /> : null}
              <span className="dm-tile-cap">
                <span>
                  <b>{c.name}</b>
                  <span>{c.productCount} قطعة</span>
                </span>
                <span aria-hidden="true">←</span>
              </span>
            </Link>
          );
        })}
      </div>
    </SectionShell>
  );
}
