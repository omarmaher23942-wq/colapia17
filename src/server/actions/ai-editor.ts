"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { getTenantDb } from "@/db/tenant";
import {
  storeBlueprints,
  storeSnapshots,
  stores,
  categories,
  products,
} from "@/db/schema";
import { getPlatformSession } from "@/server/auth";
import { aiObject } from "@/ai/providers";
import { blueprintSchema, type StoreBlueprint } from "@/blueprint/schema";
import { setPath } from "@/editor/useDraft";
import { invalidateStoreCache } from "@/lib/tenant";

const patchOut = z.object({
  explanation: z.string().max(400),
  patches: z
    .array(
      z.object({
        op: z.enum(["set", "insert_section", "remove_section", "move_section"]),
        path: z.string().optional(),
        value: z.unknown().optional(),
        index: z.number().int().optional(),
        toIndex: z.number().int().optional(),
        sectionId: z.string().optional(),
      })
    )
    .max(30),
});

/** يحوّل أمرًا بلغة طبيعية إلى Patches على الـ Blueprint، ويعيد النسخة المقترحة + شرح (بدون حفظ) */
export async function aiEditProposeAction(
  storeId: string,
  instruction: string,
  current: StoreBlueprint
) {
  if (!(await getPlatformSession())) return { error: "غير مصرح" };

  const tdb = await getTenantDb(storeId);
  const [cats, prods] = await Promise.all([
    tdb
      .select({ slug: categories.slug, name: categories.name })
      .from(categories)
      .where(eq(categories.storeId, storeId)),
    tdb
      .select({ slug: products.slug, name: products.name })
      .from(products)
      .where(eq(products.storeId, storeId)),
  ]);

  const r = await aiObject(
    "architect",
    {
      schema: patchOut,
      system: `أنت محرر متاجر خبير. تستلم Blueprint (JSON) وأمرًا بالعربية وتُخرج تعديلات دقيقة فقط. المسارات مثل "home.3.headline" أو "theme.palette.primary" أو "pages.1.body". لإضافة قسم استخدم insert_section مع value كقسم كامل صالح (id فريد، type، enabled، spacing، background، reveal، variant وحقوله). لا تغيّر ما لم يُطلب. استخدم slugs الحقيقية فقط.`,
      prompt: `الأمر: ${instruction}\n\nالأقسام: ${JSON.stringify(cats)}\nالمنتجات: ${JSON.stringify(prods)}\n\nالـ Blueprint الحالي:\n${JSON.stringify(current)}`,
      temperature: 0.3,
      maxTokens: 6000,
    },
    { purpose: "ai_editor", storeId }
  );

  let next: StoreBlueprint = JSON.parse(JSON.stringify(current));
  for (const p of r.patches) {
    try {
      if (p.op === "set" && p.path) next = setPath(next, p.path, p.value);
      if (p.op === "insert_section" && p.value)
        next.home.splice(p.index ?? next.home.length, 0, p.value as any);
      if (p.op === "remove_section")
        next.home = next.home.filter((s, i) => s.id !== p.sectionId && i !== p.index);
      if (p.op === "move_section" && p.toIndex !== undefined) {
        const i = next.home.findIndex((s) => s.id === p.sectionId);
        if (i >= 0) {
          const [m] = next.home.splice(i, 1);
          next.home.splice(p.toIndex, 0, m!);
        }
      }
    } catch {}
  }

  const v = blueprintSchema.safeParse(next);
  if (!v.success)
    return {
      error: `الاقتراح غير صالح: ${v.error.issues[0]!.path.join(".")} ${v.error.issues[0]!.message}`,
      explanation: r.explanation,
    };

  return {
    proposed: v.data,
    explanation: r.explanation,
    changed: diffPaths(current, v.data),
  };
}

/** مسارات الحقول التي تغيّرت (للـ Diff المعروض) */
function diffPaths(
  a: unknown,
  b: unknown,
  path = "",
  out: { path: string; from: unknown; to: unknown }[] = []
) {
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (
    a &&
    b &&
    typeof a === "object" &&
    typeof b === "object" &&
    !Array.isArray(a) !== !Array.isArray(b) === false
  ) {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
    if (keys.size <= 60) {
      for (const k of keys)
        diffPaths((a as any)[k], (b as any)[k], path ? `${path}.${k}` : k, out);
      return out;
    }
  }
  out.push({ path, from: a, to: b });
  return out;
}

/** حفظ من المالك على أي متجر مع Snapshot */
export async function platformSaveBlueprintAction(
  storeId: string,
  bp: StoreBlueprint,
  label: string
) {
  const u = await getPlatformSession();
  if (!u) return { error: "غير مصرح" };
  const v = blueprintSchema.safeParse(bp);
  if (!v.success) return { error: v.error.issues[0]!.message };

  const [cur] = await db
    .select()
    .from(storeBlueprints)
    .where(eq(storeBlueprints.storeId, storeId));
  const version = (cur?.version ?? 0) + 1;

  await db.batch([
    ...(cur
      ? [
          db.insert(storeSnapshots).values({
            storeId,
            version: cur.version,
            data: cur.data,
            label,
            createdBy: `platform:${u.id}`,
          })
          .onConflictDoNothing({ target: [storeSnapshots.storeId, storeSnapshots.version] }),
        ]
      : []),
    db
      .insert(storeBlueprints)
      .values({
        storeId,
        version,
        data: v.data,
        updatedBy: `platform:${u.id}`,
      })
      .onConflictDoUpdate({
        target: storeBlueprints.storeId,
        set: {
          version,
          data: v.data,
          updatedBy: `platform:${u.id}`,
          updatedAt: new Date(),
        },
      }),
    db
      .update(stores)
      .set({ reviewedBy: u.id, reviewedAt: new Date(), name: v.data.brand.name })
      .where(eq(stores.id, storeId)),
  ] as any);

  const [s] = await db.select().from(stores).where(eq(stores.id, storeId));
  await invalidateStoreCache(s!);
  return { ok: true };
}