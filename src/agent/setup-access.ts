import "server-only";
// setup-access.ts — من رمز رابط الإعداد الموقّع إلى المتجر وصاحبه (البريد يبقى على الخادم). ليس نقطة استدعاء عامة.
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { merchants, stores } from "@/db/schema";
import { verifyDerivedToken } from "./tokens";

export type SetupTarget = { storeId: string; storeName: string; merchantId: string; email: string | null; status: string };

export async function resolveSetupToken(token: unknown): Promise<SetupTarget | null> {
  const storeId = verifyDerivedToken("setup", token);
  if (!storeId) return null;
  const [row] = await db
    .select({ storeId: stores.id, storeName: stores.name, merchantId: stores.merchantId, status: stores.status, email: merchants.email })
    .from(stores)
    .innerJoin(merchants, eq(merchants.id, stores.merchantId))
    .where(eq(stores.id, storeId))
    .limit(1);
  return row ?? null;
}
