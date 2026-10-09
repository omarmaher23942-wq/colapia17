"use server";
// حركة المتجر وعمقه ثلاثي الأبعاد من «تصميم المتجر». «سينمائي» يعِد (كما في معاينته) بواجهة صور منتجات تدور في حلقة:
// عند اختياره تصير الواجهة حلقة من صور المنتجات المنشورة (4 فأكثر)، وعند تركه تعود الحلقة واجهةً عادية. غير ذلك لا يُمس.
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { getTenantDb } from "@/db/tenant";
import { products, storeBlueprints } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";
import { blueprintSchema, type StoreBlueprint } from "@/blueprint/schema";
import { saveBlueprintAction } from "./blueprint";

const input = z.object({ level: z.enum(["calm", "lively", "cinematic"]), depth: z.boolean() });

type Hero = Extract<StoreBlueprint["home"][number], { type: "hero" }>;

export async function saveMotionAction(raw: unknown): Promise<{ ok: true; orbit?: "on" | "off" | "needs_images" } | { ok: false; error: string }> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "غير مصرح" };
  const p = input.safeParse(raw);
  if (!p.success) return { ok: false, error: "اختيار غير صالح" };
  const [row] = await db.select().from(storeBlueprints).where(eq(storeBlueprints.storeId, s.storeId)).limit(1);
  const cur = row ? blueprintSchema.safeParse(row.data) : null;
  if (!cur?.success) return { ok: false, error: "تعذر قراءة تصميم المتجر" };

  let home = cur.data.home;
  let orbit: "on" | "off" | "needs_images" | undefined;
  const heroAt = home.findIndex((x) => x.type === "hero");
  const hero = heroAt >= 0 ? (home[heroAt] as Hero) : null;
  if (hero && p.data.level === "cinematic" && hero.variant !== "orbit") {
    const tdb = await getTenantDb(s.storeId);
    const rows = await tdb
      .select({ name: products.name, images: products.images })
      .from(products)
      .where(and(eq(products.storeId, s.storeId), eq(products.status, "active"), isNull(products.deletedAt), sql`jsonb_array_length(${products.images}) > 0`))
      .orderBy(desc(products.isFeatured), desc(products.orderCount), products.sortOrder)
      .limit(8);
    const images = rows.map((r) => ({ url: r.images[0]!.url, alt: r.name, focalX: 0.5, focalY: 0.4 }));
    if (images.length >= 4) {
      home = home.map((x, i) => (i === heroAt ? { ...hero, variant: "orbit", images } : x));
      orbit = "on";
    } else orbit = "needs_images";
  } else if (hero && p.data.level !== "cinematic" && hero.variant === "orbit") {
    home = home.map((x, i) => (i === heroAt ? { ...hero, variant: hero.images.length >= 3 ? "collage" : hero.images.length ? "split" : "centered" } : x));
    orbit = "off";
  }

  const r = await saveBlueprintAction({ ...cur.data, home, design: { ...cur.data.design, motion: p.data } }, "تعديل حركة المتجر");
  return r.ok ? { ok: true, orbit } : { ok: false, error: r.error };
}
