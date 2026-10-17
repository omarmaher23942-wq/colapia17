import "server-only";
// attachments.ts — صور المنتجات التي يرسلها التاجر في المحادثة: تُنزَّل من روابط Meta المؤقتة وتُعاد استضافتها في مساحة
// ملفاتنا (روابط Meta تنتهي)، ثم تظهر له في الإعداد. https فقط، وبحدود الحجم والنوع الحقيقي (fetchRemoteImage).
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { fetchRemoteImage } from "@/server/remote-image";
import { mediaApi } from "@/server/media-host";

/** الحد الأقصى للصور المحفوظة لكل عميل محتمل. */
export const MAX_DM_IMAGES = 40;
const MAX_PER_BATCH = 6;

/** يعيد استضافة الصور ويعيد روابطها الجديدة بنفس ترتيب الأصل (الفاشل يُحذف). */
export async function rehostDmImages(urls: string[], conversationId: string): Promise<string[]> {
  const list = urls.filter((u) => /^https:\/\//i.test(u)).slice(0, MAX_PER_BATCH);
  if (!list.length) return [];
  const api = await mediaApi();
  if (!api) return [];
  const done = await Promise.all(
    list.map(async (u) => {
      const r = await fetchRemoteImage(u).catch(() => null);
      if (!r?.ok) return null;
      const up = await api.upload({ bytes: r.image.bytes, name: `dm.${r.image.ext}`, type: r.image.type, ext: r.image.ext, prefix: `dm/${conversationId}` }).catch(() => null);
      return up?.url ?? null;
    })
  );
  return done.filter((u): u is string => Boolean(u));
}

/** يضيف الصور إلى stores.onboarding.dmImages بلا تكرار ولا تجاوز للحد (ذرّياً). */
export async function appendDmImages(storeId: string, urls: string[]): Promise<void> {
  if (!urls.length) return;
  await db
    .update(stores)
    .set({
      onboarding: sql`jsonb_set(${stores.onboarding}, '{dmImages}', (
        select coalesce(jsonb_agg(distinct v), '[]'::jsonb) from (
          select jsonb_array_elements(coalesce(${stores.onboarding}->'dmImages', '[]'::jsonb) || ${JSON.stringify(urls)}::jsonb) as v limit ${MAX_DM_IMAGES}
        ) t
      ), true)`,
      updatedAt: new Date(),
    })
    .where(eq(stores.id, storeId));
}
