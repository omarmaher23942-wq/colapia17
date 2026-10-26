// tenant.ts — الطريق الوحيد إلى بيانات المتجر (جداول TENANT_TABLES في planes.ts).
//
// الأصل: بيانات كل متجر في قاعدة المنصة بعزل store_id. بعد «نقل البيانات» يوجد صف في store_databases
// برابط مشفّر لقاعدة العميل، فيعيد getTenantDb عميلاً لها (مخزَّن مؤقتاً لكل متجر). يبقى getTenantDb
// المدخل الإلزامي لبيانات المتجر (يفرضه اختبار الحارس) ليبقى التوجيه والعزل في مكان واحد.
import "server-only";
import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { db, type DB } from "@/db/client";
import * as schema from "@/db/schema";
import { decryptSecret } from "@/server/transfer/crypto";

export class TenantDbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantDbError";
  }
}

type Route = { client: DB | null; at: number; urlEnc?: string };
const ROUTES = new Map<string, Route>();
/** عمر المسار المخزَّن: قصير ليلتقط كل نسخ الخادم التحويل أو الرجوع خلال ثوانٍ. */
const ROUTE_TTL_MS = 15_000;
const MAX_ROUTES = 200;

async function routeFor(storeId: string): Promise<DB | null> {
  const hit = ROUTES.get(storeId);
  if (hit && Date.now() - hit.at < ROUTE_TTL_MS) return hit.client;
  let row: { urlEnc: string } | undefined;
  try {
    [row] = await db
      .select({ urlEnc: schema.storeDatabases.urlEnc })
      .from(schema.storeDatabases)
      .where(eq(schema.storeDatabases.storeId, storeId))
      .limit(1);
  } catch {
    // الجدول غير موجود بعد (migration لم تُطبَّق): المنصة هي الأصل.
    row = undefined;
  }
  if (!row) {
    remember(storeId, { client: null, at: Date.now() });
    return null;
  }
  // الرابط لم يتغير: أعد استخدام العميل نفسه.
  if (hit?.urlEnc === row.urlEnc && hit.client) {
    hit.at = Date.now();
    return hit.client;
  }
  let url: string;
  try {
    url = await decryptSecret(row.urlEnc);
  } catch (e) {
    // لا رجوع صامت لنسخة المنصة: قد تكون قديمة بعد النقل، فنفشل بوضوح.
    throw new TenantDbError(`تعذر فتح قاعدة بيانات المتجر المنقولة: ${(e as Error).message}`);
  }
  const client = drizzle({ client: neon(url), schema, casing: "snake_case" }) as unknown as DB;
  remember(storeId, { client, at: Date.now(), urlEnc: row.urlEnc });
  return client;
}

function remember(storeId: string, r: Route) {
  if (ROUTES.size >= MAX_ROUTES) ROUTES.delete(ROUTES.keys().next().value as string);
  ROUTES.set(storeId, r);
}

/** يُستدعى بعد التحويل أو الرجوع ليلتقط هذا الخادم التغيير فوراً. */
export function forgetTenantRoute(storeId: string) {
  ROUTES.delete(storeId);
}

export async function getTenantDb(storeId: string): Promise<DB> {
  return (await routeFor(storeId)) ?? db;
}

/** قاعدة المنصة نفسها لنسخة بيانات المتجر (بعد النقل: نسخة التراجع المؤقتة). للنقل والحذف المؤجل فقط. */
export function platformCopyDb(): DB {
  return db;
}

/** لاستعلامات تجمع عدة متاجر (لوحة المالك): استعلام واحد لكل قاعدة. */
export async function groupStoresByTenantDb(storeIds: string[]): Promise<Map<DB, string[]>> {
  const out = new Map<DB, string[]>();
  for (const id of storeIds) {
    const client = await getTenantDb(id);
    out.set(client, [...(out.get(client) ?? []), id]);
  }
  return out;
}
