"use server";
// marketing.ts — إعدادات «التسويق» في لوحة التاجر: معرّفات البكسل وGA4 وتيك توك ووسم Search Console (في الـ Blueprint،
// منقّاة بـ lib/tracking.ts)، ورمز Conversions API من ميتا (سر في store_secrets لا يعود للواجهة إلا مقنّعاً).
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { storeBlueprints } from "@/db/schema";
import { storeFor } from "@/server/merchant-guard";
import { blueprintSchema } from "@/blueprint/schema";
import { cleanCapiToken, cleanGa4, cleanGoogleVerification, cleanMetaPixel, cleanTiktokPixel } from "@/lib/tracking";
import { setMetaCapiToken } from "@/server/store-secrets";
import { saveBlueprintAction } from "./blueprint";

const schema = z.object({
  metaPixelId: z.string().max(200),
  gaMeasurementId: z.string().max(200),
  tiktokPixelId: z.string().max(300),
  googleVerification: z.string().max(300),
  /** undefined = يبقى كما هو، "" = يُحذف. */
  capiToken: z.string().max(600).optional(),
});

type Result = { ok: true } | { ok: false; error: string; field?: string };

export async function saveTrackingAction(raw: z.input<typeof schema>): Promise<Result> {
  const s = await storeFor("discounts");
  if (!s) return { ok: false, error: "إعدادات التسويق تحتاج صلاحية «الخصومات والحملات»." };
  const p = schema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة" };
  const d = p.data;

  const ids = {
    metaPixelId: cleanMetaPixel(d.metaPixelId),
    gaMeasurementId: cleanGa4(d.gaMeasurementId),
    tiktokPixelId: cleanTiktokPixel(d.tiktokPixelId),
    googleVerification: cleanGoogleVerification(d.googleVerification),
  };
  const bad = (k: keyof typeof ids, msg: string): Result | null => (d[k].trim() && !ids[k] ? { ok: false, error: msg, field: k } : null);
  const err =
    bad("metaPixelId", "معرّف بكسل ميتا رقم من 10 إلى 20 خانة (من مدير الأحداث).") ??
    bad("gaMeasurementId", "معرّف GA4 يبدأ بـ G- (من إعدادات مصدر البيانات).") ??
    bad("tiktokPixelId", "معرّف بكسل تيك توك حروف وأرقام إنجليزية (من مدير الأحداث في تيك توك).") ??
    bad("googleVerification", "الصق وسم التحقق من Search Console كما هو أو قيمة content وحدها.");
  if (err) return err;
  let token: string | null | undefined;
  if (d.capiToken !== undefined) {
    token = d.capiToken.trim() ? cleanCapiToken(d.capiToken) : null;
    if (d.capiToken.trim() && !token) return { ok: false, error: "رمز Conversions API غير صحيح: انسخه كاملاً من مدير الأحداث ← الإعدادات.", field: "capiToken" };
    if (token && !ids.metaPixelId) return { ok: false, error: "أضف معرّف بكسل ميتا أولاً: الرمز يعمل معه.", field: "metaPixelId" };
  }

  const [row] = await db.select().from(storeBlueprints).where(eq(storeBlueprints.storeId, s.storeId)).limit(1);
  const cur = row ? blueprintSchema.safeParse(row.data) : null;
  if (!cur?.success) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };
  const seo = { ...cur.data.seo, metaPixelId: ids.metaPixelId ?? undefined, gaMeasurementId: ids.gaMeasurementId ?? undefined, tiktokPixelId: ids.tiktokPixelId ?? undefined, googleVerification: ids.googleVerification ?? undefined };
  const r = await saveBlueprintAction({ ...cur.data, seo }, "تعديل التتبع والإعلانات");
  if (!r.ok) return { ok: false, error: r.error };
  if (token !== undefined) await setMetaCapiToken(s.storeId, token);
  if (!ids.metaPixelId && token === undefined) await setMetaCapiToken(s.storeId, null);
  revalidatePath("/dashboard/marketing");
  return { ok: true };
}
