// fetch-pexels.ts — يستبدل الرسوم التوضيحية لمنتجات الديمو بصور فوتوغرافية حقيقية من Pexels (مرخّصة للاستخدام التجاري).
// يحتاج مفتاح Pexels API مجانياً (https://www.pexels.com/api/ تسجيل دقيقة واحدة) في متغير PEXELS_API_KEY.
// الاستخدام: PEXELS_API_KEY=... npx tsx scripts/demo/fetch-pexels.ts [--dry]
// لكل منتج فيه حقل `art`: يبحث بكلمات تناسب شكل القطعة، ينزّل الصورة العمودية الأولى المناسبة، يضغطها WebP بمقاس 900×1200
// في public/demo/fashion/<slug>-1.webp، يزيل حقل `art` من fashion.json، ويسجّل المصور والرابط في docs/demo-credits.md.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const FILE = "scripts/demo/data/fashion.json";
const QUERY: Record<string, string> = {
  dress: "woman wearing elegant dress fashion",
  maxi: "woman maxi dress fashion",
  shirtdress: "woman shirt dress fashion",
  abaya: "woman abaya modest fashion",
  abayaopen: "woman open abaya modest fashion",
  blouse: "woman blouse fashion",
  shirt: "woman shirt fashion",
  knit: "woman knit sweater fashion",
  cardigan: "woman cardigan fashion",
  trousers: "woman wide leg trousers fashion",
  skirt: "woman midi skirt fashion",
  set: "woman matching set outfit fashion",
  scarf: "woman hijab scarf fashion",
};

type Item = { slug: string; name: string; art?: { shape: string; tone: string } };
type Photo = { id: number; url: string; photographer: string; width: number; height: number; src: { large2x: string } };

async function main() {
  const dry = process.argv.includes("--dry");
  const key = process.env.PEXELS_API_KEY;
  if (!key && !dry) throw new Error("ضعوا مفتاح Pexels المجاني في PEXELS_API_KEY (https://www.pexels.com/api/)");
  const items = JSON.parse(readFileSync(FILE, "utf8")) as Item[];
  const todo = items.filter((p) => p.art);
  console.log(`منتجات بصور بديلة: ${todo.length}`);
  if (dry) return;
  const used = new Set<number>();
  const credits: string[] = [];
  for (const p of todo) {
    const q = QUERY[p.art!.shape] ?? "woman fashion";
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=portrait&per_page=15`, { headers: { Authorization: key! } });
    if (!res.ok) { console.warn(`فشل البحث لـ ${p.slug}: ${res.status}`); continue; }
    const data = (await res.json()) as { photos: Photo[] };
    const pick = data.photos.find((x) => !used.has(x.id) && x.height >= x.width * 1.2);
    if (!pick) { console.warn(`لا نتيجة مناسبة لـ ${p.slug}`); continue; }
    const img = await fetch(pick.src.large2x);
    if (!img.ok) { console.warn(`فشل التنزيل لـ ${p.slug}`); continue; }
    const buf = Buffer.from(await img.arrayBuffer());
    await sharp(buf).resize(900, 1200, { fit: "cover", position: "attention" }).webp({ quality: 80 }).toFile(`public/demo/fashion/${p.slug}-1.webp`);
    used.add(pick.id);
    delete p.art;
    credits.push(`| ${p.slug} | ${pick.photographer} | ${pick.url} | Pexels License |`);
    console.log(`✓ ${p.slug} ← ${pick.photographer}`);
  }
  writeFileSync(FILE, JSON.stringify(items, null, 2) + "\n");
  if (credits.length) appendFileSync("docs/demo-credits.md", `\n\n### صور إضافية (fetch-pexels)\n\n| المنتج | المصور | الرابط | الترخيص |\n|---|---|---|---|\n${credits.join("\n")}\n`);
  console.log(`تم: ${credits.length} صورة. شغّلوا بعدها: npx tsx scripts/demo/seed-demo.ts`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
