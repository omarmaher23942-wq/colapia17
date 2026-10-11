// seed.ts — صيغة stores/<slug>/seed.json: الأقسام والمنتجات الأولى للمتجر كما جمعها الفريق (من الاستمارة أو صفحة
// التاجر على إنستجرام). يقرؤها التجهيز (لوحة الإنتاج) والمعاينة المحلية (scripts/dev/seed-store.ts) بنفس المخطط.
// الأسعار بالجنيه كما يكتبها التاجر، وتُحوَّل لقروش عند الزرع. لا تكتب سعراً أو كمية لم يعطها التاجر.
import { z } from "zod";

export const seedProductSchema = z.object({
  name: z.string().trim().min(2).max(120),
  /** بالجنيه. */
  price: z.number().positive().max(1_000_000),
  compareAt: z.number().positive().max(1_000_000).optional(),
  /** الكمية المتاحة؛ بلا قيمة = متاح دائماً (لا تتبع مخزون). */
  stock: z.number().int().min(0).optional(),
  category: z.string().trim().min(1).max(60).optional(),
  description: z.string().max(4000).optional(),
  /** روابط https (UploadThing بعد الرفع) أو مسارات داخل brief/assets/ للمعاينة المحلية فقط. */
  images: z.array(z.string().min(1)).max(12).default([]),
  featured: z.boolean().default(false),
  /** خيارات مثل المقاس واللون: { "المقاس": ["S","M"], "اللون": ["أسود"] } تُولَّد منها التركيبات. */
  options: z.record(z.string().min(1).max(30), z.array(z.string().min(1).max(30)).min(1).max(20)).optional(),
});

export const storeSeedSchema = z.object({
  categories: z.array(z.object({ name: z.string().trim().min(1).max(60), image: z.string().optional() })).max(40).default([]),
  products: z.array(seedProductSchema).max(500).default([]),
});

export type StoreSeed = z.infer<typeof storeSeedSchema>;
export type SeedProduct = z.infer<typeof seedProductSchema>;
