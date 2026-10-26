// tenant.ts — الطريق الوحيد إلى بيانات المتجر. مشروعك يملك قاعدة واحدة لمتجر واحد، فكل الاستعلامات عليها مباشرة.
import "server-only";
import { db, type DB } from "@/db/client";

export async function getTenantDb(_storeId: string): Promise<DB> {
  return db;
}

/** لاستعلامات تجمع عدة متاجر: قاعدة واحدة. */
export async function groupStoresByTenantDb(storeIds: string[]): Promise<Map<DB, string[]>> {
  return new Map(storeIds.length ? [[db, storeIds]] : []);
}
