import "server-only";
// store-secrets.ts — أسرار تكاملات المتجر (رمز Conversions API من ميتا). تُقرأ في الخادم فقط ولا تُعاد للواجهة إلا مقنّعة.
// نسخة مشروع التاجر المستقل: template/src/server/store-secrets.ts (من جدول store_settings في قاعدته).
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { storeSecrets } from "@/db/schema";

export async function metaCapiToken(storeId: string): Promise<string | null> {
  const [r] = await db.select({ t: storeSecrets.metaCapiToken }).from(storeSecrets).where(eq(storeSecrets.storeId, storeId)).limit(1).catch(() => []);
  return r?.t || null;
}

/** null يحذف الرمز. */
export async function setMetaCapiToken(storeId: string, token: string | null): Promise<void> {
  await db
    .insert(storeSecrets)
    .values({ storeId, metaCapiToken: token })
    .onConflictDoUpdate({ target: storeSecrets.storeId, set: { metaCapiToken: token, updatedAt: sql`now()` } });
}
