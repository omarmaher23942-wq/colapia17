// transfer.ts — "امتلك متجرك" على جانب المنصة.
//
// المنصة لا تكتب في حسابات التاجر ولا تحمل مفاتيحه. بدلاً من ذلك:
//  1) يصدر التاجر "كود استلام" لمرة واحدة (نخزّن تجزئته فقط، صالح 7 أيام).
//  2) مشروعه الخاص (على Vercel الخاص به) يسحب بالكود بيانات متجره صفحةً صفحة من /api/ownership/export،
//     وينسخ الصور إلى حساب UploadThing الخاص به.
//  3) يؤكد الاستلام بأعداد الصفوف؛ نطابقها مع ما عندنا، ثم يصبح نطاق المتجر على المنصة تحويلاً
//     لموقعه الجديد، وتُحذف بيانات التجربة من المنصة (القاعدة والصور) بعد مهلة أمان.
import "server-only";
import { and, count, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { after } from "next/server";
import { UTApi } from "uploadthing/server";
import { db } from "@/db/client";
import { stores, storeTransfers, merchants } from "@/db/schema";
import { MEDIA_FREE_TABLES } from "@/db/transfer-tables";
import { secureToken, sha256 } from "@/lib/ids";
import { invalidateStoreCache } from "@/lib/tenant";
import { log } from "@/lib/logger";
import { PLAN, specFor, type TransferSpec } from "./plan";

export const TRANSFER_TTL_DAYS = 7;
/**
 * قرار المالك: بعد استلام ناجح تُحذف بيانات المتجر من المنصة فوراً (الصفوف والصور). المهلة القصيرة هنا
 * احتياط فقط: الحذف يبدأ لحظة التأكيد، وإن تعطّل لأي سبب تُكمله مهمة ops/sweep الدورية.
 */
export const PURGE_GRACE_HOURS = 0;
export const EXPORT_PAGE_SIZE = 300;
/** نسخة صيغة التصدير: مشروع التاجر يرفض صيغة لا يعرفها بدل أن يستورد بيانات ناقصة. */
export const EXPORT_FORMAT = 1;

type Store = typeof stores.$inferSelect;
type Transfer = typeof storeTransfers.$inferSelect;

export class TransferError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "TransferError";
  }
}

// ─── الكود ───────────────────────────────────────────────────────────────────

/** يصدر كوداً جديداً ويلغي أي كود سابق لم يكتمل. يُعرض للتاجر مرة واحدة. */
export async function issueTransferCode(storeId: string): Promise<{ code: string; expiresAt: Date }> {
  const code = `clp_${secureToken(30)}`;
  const expiresAt = new Date(Date.now() + TRANSFER_TTL_DAYS * 864e5);
  await db
    .update(storeTransfers)
    .set({ status: "revoked" })
    .where(and(eq(storeTransfers.storeId, storeId), inArray(storeTransfers.status, ["issued", "importing"])));
  await db.insert(storeTransfers).values({ storeId, tokenHash: await sha256(code), expiresAt });
  log.info("store", "transfer_code_issued", { storeId });
  return { code, expiresAt };
}

export async function latestTransfer(storeId: string): Promise<Transfer | null> {
  const [t] = await db
    .select()
    .from(storeTransfers)
    .where(eq(storeTransfers.storeId, storeId))
    .orderBy(sql`${storeTransfers.createdAt} desc`)
    .limit(1);
  return t ?? null;
}

/** يتحقق من كود مشروع التاجر (Authorization: Bearer). */
export async function authenticateTransfer(req: Request, opts: { allowCompleted?: boolean } = {}): Promise<{ transfer: Transfer; store: Store }> {
  const code = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!code || !code.startsWith("clp_")) throw new TransferError("كود الاستلام مفقود", 401);
  const [transfer] = await db.select().from(storeTransfers).where(eq(storeTransfers.tokenHash, await sha256(code))).limit(1);
  if (!transfer || transfer.status === "revoked") throw new TransferError("كود الاستلام غير صحيح أو أُلغي. أصدر كوداً جديداً من لوحة Colapia.", 401);
  if (transfer.status === "completed" && !opts.allowCompleted) throw new TransferError("استُخدم هذا الكود بالفعل لاستلام المتجر.", 409);
  if (transfer.expiresAt.getTime() < Date.now()) throw new TransferError("انتهت صلاحية كود الاستلام. أصدر كوداً جديداً من لوحة Colapia.", 401);
  const [store] = await db.select().from(stores).where(eq(stores.id, transfer.storeId)).limit(1);
  if (!store || store.deletedAt) throw new TransferError("المتجر غير موجود", 404);
  if (store.status !== "active") throw new TransferError("الاستلام متاح بعد تفعيل المتجر بالدفع.", 403);
  if (store.ownedAt && !(opts.allowCompleted && transfer.status === "completed")) throw new TransferError("استلم التاجر هذا المتجر بالفعل.", 409);
  return { transfer, store };
}

/** عنوان موقع التاجر: https فقط (أو localhost للتجربة)، ونحفظ الأصل وحده. */
export function normalizeSiteUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const u = new URL(raw.trim());
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(local && u.protocol === "http:")) return null;
    return u.origin;
  } catch {
    return null;
  }
}

async function touch(transfer: Transfer, siteUrl: string | null) {
  await db
    .update(storeTransfers)
    .set({ status: "importing", lastSeenAt: new Date(), ...(siteUrl ? { siteUrl } : {}) })
    .where(eq(storeTransfers.id, transfer.id));
}

// ─── التصدير ─────────────────────────────────────────────────────────────────

const tableName = (t: PgTable) => getTableConfig(t).name;

async function countRows(spec: TransferSpec, store: Store): Promise<number> {
  const [r] = await db.select({ n: count() }).from(spec.table).where(spec.scope(store.id, store.merchantId));
  return r?.n ?? 0;
}

const MEDIA_RE = /https:\/\/(?:utfs\.io|[a-z0-9-]+\.ufs\.sh)\/[^\s"'<>)\\]+/gi;

/** كل روابط الصور والملفات الصوتية في بيانات المتجر (لينسخها مشروع التاجر لحسابه). */
async function collectMedia(store: Store): Promise<string[]> {
  const urls = new Set<string>();
  for (const spec of PLAN) {
    if (MEDIA_FREE_TABLES.has(tableName(spec.table))) continue;
    const rows = await db.select().from(spec.table).where(spec.scope(store.id, store.merchantId));
    for (const m of JSON.stringify(rows).matchAll(MEDIA_RE)) urls.add(m[0]);
  }
  return [...urls];
}

export type ExportManifest = {
  format: number;
  store: { id: string; name: string; subdomain: string };
  owner: { email: string | null; displayName: string };
  tables: { name: string; count: number }[];
  media: string[];
  pageSize: number;
};

export async function exportManifest(req: Request): Promise<ExportManifest> {
  const { transfer, store } = await authenticateTransfer(req);
  await touch(transfer, normalizeSiteUrl(req.headers.get("x-site-url")));
  const [owner] = await db
    .select({ email: merchants.email, displayName: merchants.displayName })
    .from(merchants)
    .where(eq(merchants.id, store.merchantId))
    .limit(1);
  const tables = await Promise.all(PLAN.map(async (spec) => ({ name: tableName(spec.table), count: await countRows(spec, store) })));
  log.info("store", "transfer_manifest", { storeId: store.id, tables: tables.length });
  return {
    format: EXPORT_FORMAT,
    store: { id: store.id, name: store.name, subdomain: store.subdomain },
    owner: { email: owner?.email ?? null, displayName: owner?.displayName ?? store.name },
    tables,
    media: await collectMedia(store),
    pageSize: EXPORT_PAGE_SIZE,
  };
}

/** صفحة من صفوف جدول، بترتيب ثابت (بالمفتاح الأساسي)، مع تفريغ ما يشير لجداول المنصة. */
export async function exportPage(req: Request, table: string, offset: number) {
  const { transfer, store } = await authenticateTransfer(req);
  const spec = specFor(table);
  if (!spec) throw new TransferError("جدول غير معروف", 400);
  if (!Number.isInteger(offset) || offset < 0) throw new TransferError("موضع غير صالح", 400);
  await touch(transfer, null);

  const cfg = getTableConfig(spec.table);
  const pk = cfg.columns.filter((c) => c.primary);
  const order = pk.length ? pk : cfg.columns.slice(0, 1);
  const rows = await db
    .select()
    .from(spec.table)
    .where(spec.scope(store.id, store.merchantId))
    .orderBy(...order)
    .limit(EXPORT_PAGE_SIZE)
    .offset(offset);
  const out = spec.override ? rows.map((r) => ({ ...r, ...spec.override })) : rows;
  return { table, offset, rows: out, done: rows.length < EXPORT_PAGE_SIZE };
}

// ─── التأكيد ─────────────────────────────────────────────────────────────────

/**
 * مشروع التاجر يرسل أعداد ما استورده لكل جدول. إن وصلت عندنا صفوف جديدة أثناء النقل
 * (طلب جديد مثلاً) نعيد 409 بالجداول الناقصة ليستوردها ثم يؤكد من جديد.
 */
export async function completeTransfer(req: Request, body: { siteUrl?: unknown; stats?: unknown }) {
  const { transfer, store } = await authenticateTransfer(req, { allowCompleted: true });
  const siteUrl = normalizeSiteUrl(body.siteUrl);
  if (!siteUrl) throw new TransferError("عنوان الموقع غير صالح (يجب أن يبدأ بـ https://)", 400);
  // تأكيد مكرر من نفس الموقع (انقطع الاتصال قبل وصول الرد الأول): الاستلام تم، والبيانات حُذفت هنا بالفعل.
  if (transfer.status === "completed") {
    if (transfer.siteUrl === siteUrl) return { ok: true as const, purgeAfterHours: PURGE_GRACE_HOURS };
    throw new TransferError("استُخدم هذا الكود بالفعل لاستلام المتجر.", 409);
  }
  const stats = (body.stats && typeof body.stats === "object" ? body.stats : {}) as Record<string, unknown>;

  const behind: { name: string; platform: number; site: number }[] = [];
  for (const spec of PLAN) {
    const name = tableName(spec.table);
    const platform = await countRows(spec, store);
    const site = Number(stats[name] ?? 0);
    if (site < platform) behind.push({ name, platform, site });
  }
  if (behind.length) return { ok: false as const, behind };

  const now = new Date();
  await db.batch([
    db
      .update(storeTransfers)
      .set({ status: "completed", completedAt: now, siteUrl, stats: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, Number(v) || 0])) })
      .where(eq(storeTransfers.id, transfer.id)),
    db
      .update(stores)
      .set({ ownedUrl: siteUrl, ownedAt: now, purgeAfter: new Date(now.getTime() + PURGE_GRACE_HOURS * 36e5), updatedAt: now })
      .where(eq(stores.id, store.id)),
  ]);
  await invalidateStoreCache(store);
  log.info("store", "transfer_completed", { storeId: store.id, siteUrl });
  // الحذف بعد الرد: موقع التاجر لا ينتظره.
  after(() => purgeStore({ ...store, ownedAt: now }).then(() => undefined));
  return { ok: true as const, purgeAfterHours: PURGE_GRACE_HOURS };
}

// ─── الحذف بعد الاستلام ──────────────────────────────────────────────────────

const UT_KEY_RE = /https:\/\/(?:utfs\.io|[a-z0-9-]+\.ufs\.sh)\/f\/([^/?#"'\s]+)/gi;

/** يحذف بيانات المتاجر التي استلمها أصحابها ولم تُحذف بعد (احتياط لأي حذف فوري تعطّل). */
export async function purgeOwnedStores(limit = 3): Promise<{ purged: string[] }> {
  const due = await db
    .select()
    .from(stores)
    .where(and(lte(stores.purgeAfter, new Date()), isNull(stores.purgedAt)))
    .limit(limit);
  const purged: string[] = [];
  for (const store of due) if (await purgeStore(store)) purged.push(store.id);
  return { purged };
}

/** يحذف كل بيانات متجر مستلَم من المنصة: الصفوف من القاعدة والصور من UploadThing. */
export async function purgeStore(store: Store): Promise<boolean> {
  try {
    // مفاتيح الملفات أولاً (قبل حذف الصفوف التي تحمل روابطها).
    const keys = new Set<string>();
    for (const spec of PLAN) {
      if (MEDIA_FREE_TABLES.has(tableName(spec.table))) continue;
      const rows = await db.select().from(spec.table).where(spec.scope(store.id, store.merchantId));
      for (const m of JSON.stringify(rows).matchAll(UT_KEY_RE)) keys.add(m[1]!);
    }
    // صف المتجر والتاجر يبقيان (سجل الدفع، والتحويل للموقع الجديد، وبريد التاجر)؛ كل بيانات المتجر تُحذف.
    const deletable = PLAN.filter((p) => !["merchants", "stores"].includes(tableName(p.table))).reverse();
    for (const spec of deletable) await db.delete(spec.table).where(spec.scope(store.id, store.merchantId));
    if (keys.size) {
      const ut = new UTApi();
      const list = [...keys];
      for (let i = 0; i < list.length; i += 100) await ut.deleteFiles(list.slice(i, i + 100));
    }
    await db.update(stores).set({ purgedAt: new Date() }).where(and(eq(stores.id, store.id), isNull(stores.purgedAt)));
    log.info("store", "owned_store_purged", { storeId: store.id, files: keys.size });
    return true;
  } catch (e) {
    log.error("store", "owned_store_purge_failed", { storeId: store.id }, "", e);
    return false;
  }
}
