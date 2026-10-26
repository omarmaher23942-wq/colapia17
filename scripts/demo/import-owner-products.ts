// import-owner-products.ts — يضيف إلى متجر الديمو منتجات الكتالوج التي زوّدنا بها المالك (docs/owner-products-defacto.json):
// ينزّل صور كل نمط وزواياه الأخرى (الأنماط المذكورة فقط)، ويحوّلها WebP بحجم مناسب للمتجر، ويكتب المنتجات في
// scripts/demo/data/fashion.json وقسم الاعتمادات في docs/demo-credits.md. آمن لإعادة التشغيل (يستبدل بالرابط نفسه).
//   npx tsx scripts/demo/import-owner-products.ts
// الصور ملك بائعها الأصلي وقُدّمت للعرض التجريبي فقط: يجب استبدالها بصور العميل أو المرخّصة قبل أي استخدام تجاري.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const BASE = "https://dfcdn.defacto.com.tr";
/** m = على عارضة، f = قطعة مفرودة. كل عنصر: [رمز النمط واللون، الزاوية، النوع، لون الصورة إن تعدّد]. */
type Img = [code: string, view: string, kind: "m" | "f", colour?: string];
type Def = {
  slug: string; name: string; category: string; price: number; short: string; description: string; material: string; fit?: string; care: string;
  tags: string[]; sizes: boolean; colours: string[]; stock: number; featured?: boolean; ownerIds: number[]; imgs: Img[];
};

const CARE_KNIT = "غسيل لطيف بالماء البارد، والتجفيف مفروداً بعيداً عن الشمس.";
const CARE_COTTON = "غسيل بالماء البارد، وكي على حرارة متوسطة.";

export const DEFS: Def[] = [
  {
    slug: "striped-polo-collar-pullover", name: "بلوفر مقلّم بياقة بولو", category: "بلوفرات وتريكو", price: 999, ownerIds: [1],
    short: "تريكو بخطوط عريضة كحلية على أبيض، وياقة بولو وحواف مضلّعة.", description: "بلوفر تريكو بخطوط أفقية عريضة كحلية على أرضية بيضاء، بياقة بولو مفتوحة وأكمام طويلة وحواف مضلّعة عند الذيل.\nقصّته عادية تسمح بالتنسيق فوق قميص أو توب بأكمام طويلة.\nيُنسَّق مع بنطلون واسع داكن أو تنورة ميدي.",
    material: "تريكو ناعم", fit: "عادية", care: CARE_KNIT, tags: ["بلوفر", "شتاء"], sizes: true, colours: ["كحلي مقلّم"], stock: 34, featured: true,
    imgs: [["I6892AX_26WN_ER100_01", "02", "m"], ["I6892AX_26WN_ER100_02", "02", "m"], ["I6892AX_26WN_ER100_01", "01", "f"], ["I6892AX_26WN_ER100_02", "01", "f"]],
  },
  {
    slug: "burgundy-striped-crew-pullover", name: "بلوفر مقلّم بلون عنابي", category: "بلوفرات وتريكو", price: 999, ownerIds: [17],
    short: "تريكو عنابي بخطوط رفيعة بيج وياقة مستديرة مضلّعة.", description: "بلوفر تريكو بلون عنابي داكن وخطوط أفقية رفيعة بلون البيج، بياقة مستديرة وأكمام طويلة وحواف مضلّعة.\nالقماش دافئ وقصّته عادية مريحة.\nيناسب النهار مع بنطلون بيج واسع أو جينز.",
    material: "تريكو", fit: "عادية", care: CARE_KNIT, tags: ["بلوفر", "شتاء"], sizes: true, colours: ["عنابي مقلّم"], stock: 28,
    imgs: [["I6940AX_26WN_PR200_01", "02", "m"], ["I6940AX_26WN_PR200_02", "02", "m"], ["I6940AX_26WN_PR200_01", "01", "f"], ["I6940AX_26WN_PR200_02", "01", "f"]],
  },
  {
    slug: "thick-high-collar-sweatshirt", name: "سويت شيرت سميك بياقة عالية", category: "بلوفرات وتريكو", price: 999, ownerIds: [5],
    short: "قماش سميك بلون بيج فاتح وياقة عالية وطباعة صغيرة على الصدر.", description: "سويت شيرت بقماش سميك دافئ بلون بيج فاتح، بياقة عالية وأكمام طويلة وحواف مضلّعة وطباعة صغيرة على الصدر.\nالقصّة عادية وبطول يصل إلى الورك.\nيُنسَّق مع بنطلون واسع من اللون نفسه أو من لون مختلف.",
    material: "قطن سميك", fit: "عادية", care: CARE_COTTON, tags: ["كاجوال", "شتاء"], sizes: true, colours: ["بيج فاتح"], stock: 40,
    imgs: [["I0971AX_26AU_BG759_01", "02", "m"], ["I0971AX_26AU_BG759_02", "02", "m"], ["I0971AX_26AU_BG759_01", "01", "f"], ["I0971AX_26AU_BG759_02", "01", "f"]],
  },
  {
    slug: "pointed-hem-knit-skirt", name: "تنورة تريكو واسعة بحواف مدببة", category: "بناطيل وتنانير", price: 999, ownerIds: [2],
    short: "تنورة ميدي من التريكو بقصّة واسعة وحافة مدببة تتحرك مع الخطوة.", description: "تنورة ميدي من التريكو بلون بني داكن، بخصر مرن وقصّة واسعة تنتهي بحواف مدببة غير متساوية.\nتنسدل بحركة جميلة وتغطي الساق حتى أسفل الركبة.\nتُنسَّق مع بلوفر ناعم وجزمة بكعب أو حذاء مسطح.",
    material: "تريكو", fit: "واسعة", care: CARE_KNIT, tags: ["تنورة", "شتاء"], sizes: true, colours: ["بني داكن"], stock: 22, featured: true,
    imgs: [["J0479AX_26WN_BN130_01", "02", "m"], ["J0479AX_26WN_BN130_01", "03", "m"], ["J0479AX_26WN_BN130_02", "02", "m"], ["J0479AX_26WN_BN130_02", "03", "m"], ["J0479AX_26WN_BN130_01", "01", "f"], ["J0479AX_26WN_BN130_02", "01", "f"]],
  },
  {
    slug: "wide-straight-fleece-trousers", name: "بنطلون واسع بقصة مستقيمة", category: "بناطيل وتنانير", price: 999, ownerIds: [4],
    short: "قماش ناعم بلون فحمي وخصر مرتفع وساق مستقيمة واسعة.", description: "بنطلون بخصر مرتفع وساق مستقيمة واسعة بلون فحمي، من قماش ناعم يحتفظ بشكله.\nالطول يصل إلى الكاحل ويغطي القدم مع الحذاء المسطح.\nيُنسَّق مع توب بأكمام طويلة أو بلوفر.",
    material: "قماش ناعم", fit: "واسعة", care: CARE_COTTON, tags: ["بنطلون", "محتشم"], sizes: true, colours: ["فحمي"], stock: 46, featured: true,
    imgs: [["H7807AX_26AU_AR69_01", "02", "m"], ["H7807AX_26AU_AR69_02", "02", "m"], ["H7807AX_26AU_AR69_01", "01", "f"], ["H7807AX_26AU_AR69_02", "01", "f"]],
  },
  {
    slug: "mock-neck-short-sleeve-knit-top", name: "توب محبوك بياقة عالية وأكمام قصيرة", category: "بلوزات وتونيكات", price: 799, ownerIds: [7],
    short: "توب بني داكن بياقة عالية وقماش بنقشة محبوكة، يُلبس منفرداً أو فوق قميص.", description: "توب بلون بني داكن بياقة عالية وأكمام قصيرة وقماش بنقشة محبوكة ناعمة، بقصّة قريبة من الجسم وبطول يصل إلى الخصر.\nيمكن لبسه فوق بلوزة بأكمام طويلة لإطلالة محتشمة.\nيناسب التنسيق مع بنطلون واسع من اللون نفسه.",
    material: "قماش محبوك", fit: "قريبة من الجسم", care: CARE_COTTON, tags: ["توب", "طبقات"], sizes: true, colours: ["بني داكن"], stock: 30,
    imgs: [["D9758AX_26WN_BN267_01", "02", "m"], ["D9758AX_26WN_BN267_02", "02", "m"], ["D9758AX_26WN_BN267_01", "01", "f"], ["D9758AX_26WN_BN267_02", "01", "f"]],
  },
  {
    slug: "flared-sleeve-modest-tunic", name: "تونيك واسع بأكمام جرسية", category: "بلوزات وتونيكات", price: 699, ownerIds: [9, 10],
    short: "تونيك بقصّة واسعة وأكمام طويلة جرسية، بلونين، يمنح تغطية مريحة.", description: "تونيك بياقة مستديرة وأكمام طويلة تتسع عند الرسغ، بقصّة واسعة لا تلتصق بالجسم وبطول يغطي الورك.\nمتوفر باللون الأسود والبيج الفاتح.\nيُنسَّق مع جينز واسع أو تنورة ميدي، ويناسب الإطلالة المحتشمة اليومية.",
    material: "قطن", fit: "واسعة", care: CARE_COTTON, tags: ["تونيك", "محتشم"], sizes: true, colours: ["أسود", "بيج فاتح"], stock: 52, featured: true,
    imgs: [["J1594AX_26AU_BK81_01", "01", "m", "أسود"], ["J1594AX_26AU_ER37_01", "01", "m", "بيج فاتح"], ["J1594AX_26AU_BK81_02", "01", "m", "أسود"], ["J1594AX_26AU_ER37_02", "01", "m", "بيج فاتح"]],
  },
  {
    slug: "white-slim-long-sleeve-top", name: "توب أبيض بأكمام طويلة وقصّة ضيقة", category: "بلوزات وتونيكات", price: 499, ownerIds: [13],
    short: "توب بيزك أبيض بأكمام طويلة وياقة مستديرة، أساس للتنسيق تحت الجاكيت والبلوفر.", description: "توب أبيض بأكمام طويلة وياقة مستديرة وقصّة ضيقة، قماش ناعم مضلّع الملمس.\nقطعة أساسية تُلبس وحدها أو تحت بلوزة أو جاكيت.\nتنسّق مع جينز واسع أو بنطلون قماش.",
    material: "قطن مرن", fit: "ضيقة", care: CARE_COTTON, tags: ["توب", "أساسيات"], sizes: true, colours: ["أبيض"], stock: 64,
    imgs: [["I4450AX_26AU_ER105_01", "01", "m"], ["I4450AX_26AU_ER105_02", "01", "m"]],
  },
  {
    slug: "red-draped-side-long-sleeve-top", name: "بلوزة بأكمام طويلة بتجميعة جانبية", category: "بلوزات وتونيكات", price: 999, ownerIds: [19],
    short: "بلوزة حمراء بتجميعة عند الخصر وحافة سفلية غير متساوية.", description: "بلوزة بأكمام طويلة بلون أحمر مشرق، بتجميعة جانبية عند الخصر وحافة سفلية غير متساوية.\nالياقة مستديرة والقماش ناعم يلائم الجسم.\nتُنسَّق مع جينز مستقيم أو بنطلون أسود.",
    material: "قطن", fit: "قريبة من الجسم", care: CARE_COTTON, tags: ["بلوزة", "مناسبات"], sizes: true, colours: ["أحمر"], stock: 18,
    imgs: [["J1123AX_26WN_RD44_01", "02", "m"], ["J1123AX_26WN_RD44_02", "02", "m"], ["J1123AX_26WN_RD44_01", "01", "f"], ["J1123AX_26WN_RD44_02", "01", "f"]],
  },
  {
    slug: "lace-high-neck-puff-sleeve-top", name: "بلوزة دانتيل بياقة عالية وأكمام منفوخة", category: "بلوزات وتونيكات", price: 1299, ownerIds: [23],
    short: "دانتيل كريمي بياقة عالية وأكمام طويلة منفوخة عند الكتف.", description: "بلوزة من الدانتيل بلون كريمي، بياقة عالية وأكمام طويلة منفوخة عند الكتف، وتُلبس فوق توب داخلي.\nالتغطية كاملة للرقبة والذراعين، والقصّة قريبة من الجسم.\nتناسب المناسبات مع بنطلون واسع أسود أو جينز داكن.",
    material: "دانتيل", fit: "قريبة من الجسم", care: "غسيل يدوي لطيف بالماء البارد، وتجفيف مفروداً.", tags: ["بلوزة", "مناسبات", "محتشم"], sizes: true, colours: ["كريمي"], stock: 14, featured: true,
    imgs: [["I9650AX_26WN_ER138_01", "01", "m"], ["I9650AX_26WN_ER138_01", "02", "m"], ["I9650AX_26WN_ER138_02", "01", "m"], ["I9650AX_26WN_ER138_02", "02", "m"]],
  },
  {
    slug: "leopard-print-faux-fur-jacket", name: "جاكيت فرو صناعي بطبعة منقّطة", category: "جواكت ومعاطف", price: 2699, ownerIds: [15],
    short: "فرو صناعي ناعم ببقع داكنة على أرضية بيج، وياقة عريضة.", description: "جاكيت قصير من الفرو الصناعي بطبعة بقع داكنة على أرضية بيج، بياقة عريضة وأكمام طويلة وقصّة عادية.\nدافئ وخفيف ويضيف طابعاً مميزاً لأي إطلالة.\nيُنسَّق مع جينز واسع أو بنطلون قماش.",
    material: "فرو صناعي", fit: "عادية", care: "تنظيف جاف، ويُحفظ معلّقاً.", tags: ["جاكيت", "شتاء"], sizes: true, colours: ["بيج منقّط"], stock: 9, featured: true,
    imgs: [["I2263AX_26WN_ER128_01", "02", "m"], ["I2263AX_26WN_ER128_02", "02", "m"], ["I2263AX_26WN_ER128_01", "01", "f"], ["I2263AX_26WN_ER128_02", "01", "f"]],
  },
  {
    slug: "red-crossover-collar-jacket", name: "جاكيت أحمر بياقة متقاطعة", category: "جواكت ومعاطف", price: 3299, ownerIds: [21],
    short: "جاكيت بقصّة بالون وياقة متقاطعة بلون أحمر قاني.", description: "جاكيت بلون أحمر قاني، بياقة متقاطعة وأكمام طويلة وقصّة بالون تتجمع عند الذيل.\nالقماش ناعم الملمس ويعطي حجماً أنيقاً من دون ثقل.\nيناسب التنسيق مع بنطلون أسود أو جينز داكن.",
    material: "قماش ناعم", fit: "بالون", care: "تنظيف جاف.", tags: ["جاكيت", "مناسبات"], sizes: true, colours: ["أحمر قاني"], stock: 7,
    imgs: [["J0172AX_26WN_RD1_01", "01", "f"], ["J0172AX_26WN_RD1_02", "01", "f"]],
  },
  {
    slug: "striped-two-piece-pyjama-set", name: "طقم بيجامة مقلّم قطعتين", category: "أطقم وملابس منزلية", price: 1499, ownerIds: [22],
    short: "قميص بياقة مفتوحة وبنطلون بحزام ربط، بخطوط وردية على أبيض.", description: "طقم من قطعتين: قميص بأكمام طويلة وياقة مفتوحة وأزرار، وبنطلون واسع بحزام ربط عند الخصر، بخطوط رفيعة وردية على أرضية بيضاء.\nمريح للنوم والجلوس في المنزل.\nالقصّة عادية بتغطية كاملة للذراعين والساقين.",
    material: "قطن", fit: "عادية", care: CARE_COTTON, tags: ["منزلي", "طقم"], sizes: true, colours: ["وردي مقلّم"], stock: 26,
    imgs: [["G2395AX_26AU_PR461_01", "01", "f"], ["G2395AX_26AU_PR461_02", "01", "f"]],
  },
  {
    slug: "plush-wrap-collar-robe", name: "روب منزلي قطيفة بياقة شال وحزام", category: "أطقم وملابس منزلية", price: 1299, ownerIds: [16],
    short: "قطيفة ناعمة بلون وردي ترابي، بياقة شال وحزام ربط.", description: "روب منزلي من القطيفة الناعمة بلون وردي ترابي، بياقة شال متقاطعة وحزام ربط عند الخصر وأكمام طويلة.\nدافئ وخفيف في الشتاء، ويصلح للصباح أو بعد الاستحمام.",
    material: "قطيفة", fit: "عادية", care: "غسيل لطيف بالماء البارد، وتجفيف بحرارة منخفضة.", tags: ["منزلي", "شتاء"], sizes: true, colours: ["وردي ترابي"], stock: 20,
    imgs: [["A3437AX_26AU_BR86_01", "01", "f"], ["A3437AX_26AU_BR86_02", "01", "f"]],
  },
  {
    slug: "knit-shoulder-wrap-tie", name: "وشاح كتف تريكو بعقدة أمامية", category: "إكسسوارات وأحذية", price: 599, ownerIds: [20, 24],
    short: "قطعة تريكو تُلبس على الكتفين وتُعقد من الأمام، بلونين.", description: "وشاح كتف من التريكو بقصّة مربعة بفتحة للرقبة، يُعقد من الأمام أو يُترك مفتوحاً على الكتفين.\nيضيف دفئاً وطبقة أنيقة فوق أي بلوزة أو فستان.\nمتوفر بالأحمر الداكن والبني الداكن.",
    material: "تريكو", care: CARE_KNIT, tags: ["أوشحة", "شتاء"], sizes: false, colours: ["أحمر داكن", "بني داكن"], stock: 44,
    imgs: [["I4750AX_26WN_RD2_01", "01", "f", "أحمر داكن"], ["I4750AX_26WN_BN66_01", "01", "f", "بني داكن"], ["I4750AX_26WN_RD2_02", "01", "f", "أحمر داكن"], ["I4750AX_26WN_BN66_02", "01", "f", "بني داكن"]],
  },
  {
    slug: "soft-fringe-scarf-beige", name: "وشاح ناعم بأهداب بلون بيج فاتح", category: "إكسسوارات وأحذية", price: 599, ownerIds: [11],
    short: "وشاح طويل بملمس ناعم دافئ وأهداب عند الطرفين.", description: "وشاح طويل بلون بيج فاتح وملمس ناعم دافئ، بأهداب عند الطرفين.\nيُلف حول الرقبة أو يُترك مسدلاً على الكتفين.\nيُنسَّق مع المعاطف والجواكت بألوان محايدة.",
    material: "خامة ناعمة دافئة", care: CARE_KNIT, tags: ["أوشحة", "شتاء"], sizes: false, colours: ["بيج فاتح"], stock: 48,
    imgs: [["F3423AX_26WN_ER2_01", "01", "f"], ["F3423AX_26WN_ER2_02", "01", "f"]],
  },
  {
    slug: "dark-brown-fringe-scarf", name: "وشاح بني داكن بأهداب طويلة", category: "إكسسوارات وأحذية", price: 699, ownerIds: [18],
    short: "وشاح طويل بلون بني داكن وأهداب عند الأطراف.", description: "وشاح طويل بلون بني داكن، بخامة ناعمة وأهداب طويلة عند الطرفين.\nيُلف مرتين حول الرقبة أو يُترك مفتوحاً.\nيناسب تنسيقات الشتاء مع المعاطف الفاتحة والداكنة.",
    material: "خامة ناعمة", care: CARE_KNIT, tags: ["أوشحة", "شتاء"], sizes: false, colours: ["بني داكن"], stock: 36,
    imgs: [["I2985AX_26WN_BN66_01", "01", "f"], ["I2985AX_26WN_BN66_02", "01", "f"]],
  },
  {
    slug: "winter-baseball-cap-grey", name: "كاب شتوي رمادي بحافة سوداء", category: "إكسسوارات وأحذية", price: 599, ownerIds: [12],
    short: "كاب بقماش صوفي ناعم بلون رمادي وحافة سوداء وتطريز بخط يدوي.", description: "كاب بقماش صوفي ناعم بلون رمادي وحافة سوداء، بتطريز كتابي على الجانب.\nمقاسه قابل للتعديل من الخلف.\nيناسب الإطلالات الكاجوال في الشتاء.",
    material: "قماش صوفي", care: "غسيل يدوي لطيف، ويُجفَّف في الهواء.", tags: ["قبعات", "شتاء"], sizes: false, colours: ["رمادي دافئ"], stock: 33,
    imgs: [["U9363AZ_26WN_GR2_01", "01", "f"], ["U9363AZ_26WN_GR2_02", "01", "f"]],
  },
  {
    slug: "black-cuffed-knit-beanie", name: "قبعة تريكو سوداء بحافة مطوية", category: "إكسسوارات وأحذية", price: 249, ownerIds: [14],
    short: "قبعة تريكو سادة بحافة مطوية، تمنح الرأس دفئاً.", description: "قبعة من التريكو بلون أسود سادة وحافة مطوية.\nتناسب الأيام الباردة وتُنسَّق مع أي إطلالة كاجوال.",
    material: "تريكو", care: CARE_KNIT, tags: ["قبعات", "شتاء"], sizes: false, colours: ["أسود"], stock: 60,
    imgs: [["R7545AZ_26WN_BK27_01", "01", "f"], ["R7545AZ_26WN_BK27_02", "01", "f"]],
  },
];

const photoUrl = (code: string, view: string, size: 410 | 1000 = 1000) => `${BASE}/${size}/${code}_${view}.jpg`;
const fileOf = (slug: string, n: number) => `${slug}-${n}.webp`;

async function toWebp(buf: Buffer): Promise<Buffer> {
  for (const q of [84, 78, 72, 66, 60, 54]) {
    const out = await sharp(buf).rotate().resize({ width: 900, height: 1200, fit: "inside", withoutEnlargement: true }).webp({ quality: q, effort: 5 }).toBuffer();
    if (out.length <= 140 * 1024) return out;
  }
  throw new Error("تعذّر ضغط الصورة تحت 140KB");
}

async function main() {
  const dir = join(ROOT, "public/demo/fashion");
  mkdirSync(dir, { recursive: true });
  const dataPath = join(ROOT, "scripts/demo/data/fashion.json");
  const data = JSON.parse(readFileSync(dataPath, "utf8")) as Record<string, unknown>[];
  const credits: { slug: string; name: string; files: { file: string; url: string }[] }[] = [];
  for (const d of DEFS) {
    const files: { file: string; url: string }[] = [];
    for (let i = 0; i < d.imgs.length; i++) {
      const [code, view] = d.imgs[i]!;
      const url = photoUrl(code, view);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} → ${res.status}`);
      const buf = await toWebp(Buffer.from(await res.arrayBuffer()));
      writeFileSync(join(dir, fileOf(d.slug, i + 1)), buf);
      files.push({ file: fileOf(d.slug, i + 1), url: photoUrl(code, view, 410).replace("/410/", "/1000/") });
    }
    credits.push({ slug: d.slug, name: d.name, files });
    const alt = d.imgs.map(([, , kind, colour]) => `${d.name}${colour ? ` بلون ${colour}` : ""} (${kind === "m" ? "على عارضة" : "القطعة مفرودة"})`);
    const row = {
      slug: d.slug, name: d.name, category: d.category, price: d.price, compareAt: null, shortDescription: d.short, description: d.description,
      material: d.material, ...(d.fit ? { fit: d.fit } : {}), care: d.care, tags: d.tags,
      options: [...(d.sizes ? [{ name: "المقاس", values: ["S", "M", "L", "XL"] }] : []), { name: "اللون", values: d.colours }],
      stock: d.stock, featured: Boolean(d.featured), isNew: false, images: files.map((f) => `/demo/fashion/${f.file}`), alt,
    };
    const at = data.findIndex((p) => p.slug === d.slug);
    if (at >= 0) data[at] = row;
    else data.push(row);
    console.log(`${d.slug}: ${files.length} صور`);
  }
  writeFileSync(dataPath, JSON.stringify(data, null, 1) + "\n");

  // اعتمادات الكتالوج المقدَّم من المالك: قسم محدد بعلامتين يُعاد توليده في كل تشغيل.
  const creditsPath = join(ROOT, "docs/demo-credits.md");
  const rows = credits.flatMap((c) => c.files.map((f) => `| ${c.name} | \`${f.file}\` | ${f.url} |`));
  const block = [
    "<!-- owner-catalogue:start -->",
    "### كتالوج مقدَّم من المالك (للعرض التجريبي فقط)",
    "",
    "صور هذه المنتجات هي صور كتالوج لبائع تجزئة آخر، قدّمها المالك للاستخدام في هذا الديمو فقط. **حقوقها ملك بائعها الأصلي**، ولا يجوز استخدامها في أي متجر حقيقي ولا في أي مادة تجارية. يجب استبدالها بصور العميل نفسه أو بصور مرخّصة قبل أي استخدام تجاري، ثم حذفها من المستودع.",
    "",
    "| المنتج | الملف | رابط المصدر |",
    "|---|---|---|",
    ...rows,
    "",
    "الملفات التي تُحذف عند إزالتها: كل `public/demo/fashion/<slug>-N.webp` للأرقام المذكورة أعلاه (الأسماء `" + credits.map((c) => c.slug).join("`، `") + "`)، ثم إزالة المنتجات نفسها من `scripts/demo/data/fashion.json` وتشغيل `npx tsx scripts/demo/export-store-files.ts`. الأوامر: `git rm public/demo/fashion/{" + credits.map((c) => c.slug + "-*.webp").join(",") + "}`.",
    "<!-- owner-catalogue:end -->",
  ].join("\n");
  let md = readFileSync(creditsPath, "utf8");
  const re = /<!-- owner-catalogue:start -->[\s\S]*?<!-- owner-catalogue:end -->/;
  md = re.test(md) ? md.replace(re, block) : md.replace(/\n### رسوم توضيحية بديلة/, `\n${block}\n\n### رسوم توضيحية بديلة`);
  writeFileSync(creditsPath, md);
}

if (process.argv[1]?.includes("import-owner-products")) void main();
