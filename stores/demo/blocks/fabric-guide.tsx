// الخامات في هذه المجموعة: العدّاد من سمة «الخامة» في منتجات المتجر فعلاً، والإرشاد عام عن الخامة لا وعد عن منتج بعينه.
import { SectionShell, type BlockProps } from "@/stores-kit";

const FAMILIES: { key: string; re: RegExp; fits: string; care: string }[] = [
  { key: "ساتان", re: /ساتان/, fits: "مناسبات ولمعة ناعمة", care: "غسيل لطيف بالماء البارد" },
  { key: "كتان", re: /كتان/, fits: "أجواء دافئة وتهوية", care: "يُكوى وهو رطب قليلاً" },
  { key: "كريب", re: /كريب/, fits: "انسدال وتغطية", care: "كي على الوجه الخلفي" },
  { key: "صوف وحياكة", re: /صوف|محبوك|حياكة/, fits: "طبقات الشتاء", care: "غسيل يدوي ويُجفَّف مفروداً" },
  { key: "مخمل", re: /مخمل/, fits: "سهرات ولمعة هادئة", care: "تنظيف جاف" },
  { key: "جلد", re: /جلد/, fits: "أحذية وحقائب", care: "يُمسح بقطعة ناعمة" },
  { key: "قطن", re: /قطن|بوبلين/, fits: "ارتداء يومي مريح", care: "غسيل عادي" },
];

export default async function FabricGuide({ s, kit }: BlockProps) {
  const cats = await kit.data.categories();
  const lists = await Promise.all(cats.map((c) => kit.data.products({ source: { type: "category", slug: c.slug }, limit: 24 })));
  const seen = new Map<string, string>();
  for (const p of lists.flat()) {
    const attrs = (p.attributes ?? []) as { label: string; value: string }[];
    seen.set(p.id, attrs.find((a) => a.label === "الخامة")?.value ?? "");
  }
  // كل خامة تُحسب لأول عائلة تطابقها (كتان مخلوط بالقطن = كتان) فلا عدّ مزدوج.
  const familyOf = (v: string) => FAMILIES.find((f) => f.re.test(v))?.key;
  const cards = FAMILIES.map((f) => ({ ...f, n: [...seen.values()].filter((v) => familyOf(v) === f.key).length })).filter((f) => f.n > 0);
  if (cards.length < 3) return null;
  return (
    <SectionShell s={s}>
      <div className="dm-head">
        <p className="dm-eyebrow">الخامات</p>
        <h2 className="dm-title">{s.title ?? "الخامات في هذه المجموعة"}</h2>
        <p className="dm-lead">خامة كل قطعة مكتوبة في صفحتها، وهذه نظرة سريعة على ما يتكرر في المتجر وطريقة العناية بكل خامة.</p>
      </div>
      <div className="dm-fabrics" data-demo-block="fabric-guide">
        {cards.map((c) => (
          <div key={c.key} className="dm-fabric">
            <small>{c.n} قطعة</small>
            <h3>{c.key}</h3>
            <p>يناسب: {c.fits}</p>
            <p>العناية: {c.care}</p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
