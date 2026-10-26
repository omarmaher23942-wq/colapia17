// plan.ts — ما يُنسخ إلى قاعدة العميل وبأي ترتيب (يحترم المفاتيح الأجنبية). خالص: لا اتصال بقاعدة.
import { eq, getTableColumns, type SQL } from "drizzle-orm";
import { getTableConfig, type AnyPgColumn, type PgTable } from "drizzle-orm/pg-core";
import * as s from "@/db/schema";
import { TENANT_TABLES } from "@/db/planes";

export type CopySpec = {
  name: string;
  table: PgTable;
  scope: (storeId: string, merchantId: string) => SQL;
  /** يُتجاوز إن لم يوجد في الهدف وكان فارغاً في المصدر (جداول لا يحملها مشروع العميل). */
  optional?: boolean;
  /** قيم تُفرض في الهدف (حقول تخص فريق المنصة). */
  override?: Record<string, unknown>;
};

const OPTIONAL = new Set<string>(["support_threads", "support_messages"]);

const TABLE_BY_NAME = new Map<string, PgTable>(
  Object.values(s as Record<string, unknown>)
    .filter((v): v is PgTable => typeof v === "object" && v !== null && isPgTable(v))
    .map((t) => [getTableConfig(t).name, t] as const)
);

function isPgTable(v: unknown): v is PgTable {
  try {
    return !!getTableConfig(v as PgTable).name;
  } catch {
    return false;
  }
}

function storeIdCol(t: PgTable): AnyPgColumn {
  return (getTableColumns(t) as Record<string, AnyPgColumn>).storeId!;
}

const tenantSpec = (name: string): CopySpec => {
  const table = TABLE_BY_NAME.get(name);
  if (!table) throw new Error(`جدول غير معروف في خطة النقل: ${name}`);
  return {
    name,
    table,
    scope: (id) => eq(storeIdCol(table), id),
    optional: OPTIONAL.has(name),
    override: name === "support_threads" ? { assignedTo: null } : undefined,
  };
};

export const COPY_PLAN: CopySpec[] = [
  { name: "merchants", table: s.merchants, scope: (_, m) => eq(s.merchants.id, m) },
  {
    name: "stores",
    table: s.stores,
    scope: (id) => eq(s.stores.id, id),
    // حقول فريق المنصة لا معنى لها في قاعدة العميل.
    override: { reviewedBy: null },
  },
  { name: "store_blueprints", table: s.storeBlueprints, scope: (id) => eq(s.storeBlueprints.storeId, id) },
  { name: "store_snapshots", table: s.storeSnapshots, scope: (id) => eq(s.storeSnapshots.storeId, id) },
  // TENANT_TABLES مرتبة أصلاً بحيث تسبق الجداول ما يشير إليها (يفرضه اختبار الخطة).
  ...TENANT_TABLES.map(tenantSpec),
];

export const COPY_NAMES = COPY_PLAN.map((p) => p.name);

export function specByName(name: string): CopySpec | undefined {
  return COPY_PLAN.find((p) => p.name === name);
}

/** أعمدة المفتاح الأساسي مرتبة (للترتيب الثابت عند القراءة بدفعات وللإدراج المتكرر). */
export function primaryKeyColumns(table: PgTable): AnyPgColumn[] {
  const cfg = getTableConfig(table);
  const composite = cfg.primaryKeys[0]?.columns;
  if (composite?.length) return composite as AnyPgColumn[];
  return (cfg.columns as AnyPgColumn[]).filter((c) => c.primary);
}
