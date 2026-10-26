import "server-only";
// project.ts — عقد V4 (K2): مولّد مشروع التسليم. يقرأ هوية الطلب من القاعدة ويعيد ملفات المشروع المستقل للعميل
// (الكود المتتبَّع + overlay + مجلد المتجر المخصص stores/<slug>/ إن وُجد + setup-recipe.json إن وُجد).
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { storeRequests } from "@/db/schema";
import { buildDeliveryProject } from "./build";
import { normalizeSlug } from "./inject";
import { platformSource } from "./source";
import type { DeliveryIdentity, ProjectFiles } from "./types";

export type { ProjectFiles };

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** هوية العميل من صف الطلب (الحقول المنسوخة أولاً ثم data، لتحمّل تغيّر شكل البيانات). */
export function identityFromRequest(row: {
  code?: string | null;
  slug?: string | null;
  storeName?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  data?: Record<string, unknown> | null;
}): DeliveryIdentity {
  const d = row.data ?? {};
  const storeName = row.storeName || str(d.storeName) || str(d.name);
  const ownerEmail = (row.email || str(d.email) || "").toLowerCase();
  if (!storeName) throw new Error("اسم المتجر غير موجود في الطلب");
  if (!ownerEmail) throw new Error("بريد صاحب المتجر غير موجود في الطلب (مطلوب لدخول اللوحة)");
  const folder = str(row.slug) ?? str(d.slug);
  return {
    storeName,
    slug: normalizeSlug(folder ?? storeName),
    storeFolder: folder ? normalizeSlug(folder) : null,
    ownerEmail,
    niche: str(d.niche) ?? str(d.industry),
    instagram: str(d.instagram),
    whatsapp: row.whatsapp || str(d.whatsapp),
    themeId: str(d.themeId) ?? str(d.theme),
    templateId: str(d.templateId),
    requestCode: row.code ?? null,
  };
}

/** ملفات مشروع المتجر المستقل لطلب معين (الهوية من بيانات الطلب). */
export async function projectFilesForRequest(requestId: string): Promise<ProjectFiles> {
  const [row] = await db.select().from(storeRequests).where(eq(storeRequests.id, requestId)).limit(1);
  if (!row) throw new Error("الطلب غير موجود");
  const id = identityFromRequest({ ...row, data: (row.data ?? {}) as Record<string, unknown> });
  const { files, missing } = await buildDeliveryProject(await platformSource(), id);
  // استيراد لم يُحل يعني مشروعاً لن يُبنى: لا نسلّم مشروعاً معطوباً أبداً.
  if (missing.length) throw new Error(`مشروع التسليم فيه استيرادات غير محلولة: ${missing.slice(0, 5).join("، ")}`);
  return Object.fromEntries(files.map((f) => [f.path, f.data]));
}
