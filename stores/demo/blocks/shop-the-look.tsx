// تسوقوا الإطلالة: صورة كبيرة وقطع الإطلالة بأسعارها الحية من الكتالوج وإجماليها. لا خصم مخترع على الشراء معاً.
import Image from "next/image";
import Link from "next/link";
import { Price, SectionShell, formatEgp, type BlockProps } from "@/stores-kit";

type Props = { image?: string; alt?: string; caption?: string; items?: { slug: string; role: string }[] };

export default async function ShopTheLook({ s, props, kit }: BlockProps<Props>) {
  const found = await Promise.all((props.items ?? []).map(async (i) => ({ role: i.role, p: await kit.data.product(i.slug) })));
  const items = found.filter((x): x is { role: string; p: NonNullable<typeof x.p> } => Boolean(x.p));
  if (!props.image || items.length < 2) return null;
  const total = items.reduce((a, x) => a + x.p.pricePiasters, 0);
  return (
    <SectionShell s={s}>
      <div className="dm-look" data-demo-block="shop-the-look">
        <div className="dm-look-img">
          <Image src={props.image} alt={props.alt ?? ""} fill sizes="(min-width:900px) 45vw, 100vw" />
        </div>
        <div>
          <p className="dm-eyebrow">إطلالة كاملة</p>
          <h2 className="dm-title">{s.title ?? "تسوقوا الإطلالة"}</h2>
          {props.caption ? <p className="dm-lead mt-3">{props.caption}</p> : null}
          <ul className="dm-look-list mt-6">
            {items.map(({ role, p }) => (
              <li key={p.id}>
                <Link href={`/p/${encodeURIComponent(p.slug)}`} className="dm-look-item">
                  <span className="dm-look-thumb">
                    {p.images[0] ? <Image src={p.images[0].url} alt="" fill sizes="72px" /> : null}
                  </span>
                  <span>
                    <span className="dm-role">{role}</span>
                    <span className="block text-sm font-bold">{p.name}</span>
                  </span>
                  <Price price={p.pricePiasters} compareAt={p.compareAtPiasters} size="sm" showSavings={false} />
                </Link>
              </li>
            ))}
          </ul>
          <p className="dm-total mt-5">
            <span>إجمالي الإطلالة</span>
            <span>{formatEgp(total)}</span>
          </p>
          <p className="mt-2 text-xs opacity-70">اختاروا المقاس واللون لكل قطعة من صفحتها.</p>
        </div>
      </div>
    </SectionShell>
  );
}
