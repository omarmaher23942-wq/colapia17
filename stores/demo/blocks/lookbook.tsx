// إطلالات من المجموعة: صور تحريرية، كل صورة تقود إلى القطعة المقابلة في الكتالوج (تُعرض فقط إن كانت موجودة).
import Image from "next/image";
import Link from "next/link";
import { SectionShell, type BlockProps } from "@/stores-kit";

type Look = { image: string; alt?: string; title: string; slug: string };

export default async function Lookbook({ s, props, kit }: BlockProps<{ looks?: Look[] }>) {
  const looks = await Promise.all((props.looks ?? []).map(async (l) => ((await kit.data.product(l.slug)) ? l : null)));
  const shown = looks.filter((l): l is Look => Boolean(l));
  if (shown.length < 2) return null;
  return (
    <SectionShell s={s}>
      <div className="dm-head">
        <p className="dm-eyebrow">لوكبوك</p>
        <h2 className="dm-title">{s.title ?? "إطلالات من المجموعة"}</h2>
      </div>
      <div className="dm-looks" data-demo-block="lookbook">
        {shown.map((l) => (
          <Link key={l.slug} href={`/p/${encodeURIComponent(l.slug)}`} className="dm-lk">
            <Image src={l.image} alt={l.alt ?? l.title} fill sizes="(min-width:900px) 25vw, 50vw" />
            <span className="dm-lk-cap">
              <b>{l.title}</b>
              <span>اكتشفوا القطعة</span>
            </span>
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}
