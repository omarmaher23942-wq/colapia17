import "server-only";
// purge.ts — حذف بيانات استمارة الطلب مع ملفاتها من مساحة الملفات (R2 أو UploadThing):
//   - مسودات انتهت مهلتها ولم تُرسل (يشغّله ops/tick يومياً)،
//   - ملفات رفعها العميل ثم حذفها أو استبدلها قبل الإرسال (بعد الإرسال مباشرة)،
//   - حذف طلب نهائياً بطلب العميل (من لوحة الفريق).
// القاعدة الثابتة: صفوف الملفات هي السجل الوحيد لمفاتيح UploadThing، فلا يُحذف صف قبل أن يُؤكَّد حذف ملفه (وإلا
// يبقى الملف يتيماً إلى الأبد مخالفاً لما وعدنا به في سياسة الخصوصية). فشل الحذف = يبقى الصف لمحاولة قادمة.
import { and, eq, inArray, lt, notInArray } from "drizzle-orm";
import { db } from "@/db/client";
import { storeRequestAssets, storeRequests } from "@/db/schema/agency";
import { mediaApi } from "@/server/media-host";
import { referencedKeys, type IntakeData } from "./schema";

const CHUNK = 100;

/** يحذف الملفات من UploadThing على دفعات. true فقط إن نجحت كل الدفعات (نجاح الطلب لا عدد المحذوفات: مفتاح محذوف سابقاً يُعدّ نجاحاً). */
export async function deleteStoredFiles(keys: string[]): Promise<boolean> {
  if (!keys.length) return true;
  const api = await mediaApi();
  if (!api) return false;
  for (let i = 0; i < keys.length; i += CHUNK) {
    if (!(await api.remove(keys.slice(i, i + CHUNK)).catch(() => false))) return false;
  }
  return true;
}

export async function purgeExpiredDrafts(limit = 100): Promise<{ requests: number; files: number; deferred: number }> {
  const expired = await db
    .select({ id: storeRequests.id })
    .from(storeRequests)
    .where(and(eq(storeRequests.status, "draft"), lt(storeRequests.expiresAt, new Date())))
    .limit(limit);
  if (!expired.length) return { requests: 0, files: 0, deferred: 0 };

  const assets = await db
    .select({ requestId: storeRequestAssets.requestId, key: storeRequestAssets.key })
    .from(storeRequestAssets)
    .where(inArray(storeRequestAssets.requestId, expired.map((r) => r.id)));
  const keysOf = new Map<string, string[]>();
  for (const a of assets) keysOf.set(a.requestId, [...(keysOf.get(a.requestId) ?? []), a.key]);

  // طلباً طلباً: فشل حذف ملفات طلب لا يوقف غيره، ويبقى صفه (ومفاتيحه) ليُعاد غداً.
  const deletable: string[] = [];
  let files = 0;
  for (const { id } of expired) {
    const keys = keysOf.get(id) ?? [];
    if (await deleteStoredFiles(keys)) {
      deletable.push(id);
      files += keys.length;
    }
  }
  if (deletable.length) {
    // يُعاد فحص الحالة والمهلة وقت الحذف: مسودة أُعيد فتحها (رابط الوكيل) أو أُرسلت بعد الاختيار لا تُحذف.
    await db.delete(storeRequests).where(and(inArray(storeRequests.id, deletable), eq(storeRequests.status, "draft"), lt(storeRequests.expiresAt, new Date())));
  }
  return { requests: deletable.length, files, deferred: expired.length - deletable.length };
}

/**
 * بعد الإرسال: ملفات رفعها العميل ولم يعد الطلب يشير إليها (حذفها أو استبدل التسجيل) تُحذف من UploadThing ويُحذف
 * صفها. أي ملف يفشل حذفه يبقى صفه فيُحاول مرة أخرى لاحقاً.
 */
export async function pruneUnreferencedAssets(requestId: string, data: IntakeData): Promise<number> {
  const refs = referencedKeys(data);
  const keep = [...refs.images, refs.logo, refs.voice].filter((k): k is string => Boolean(k));
  const orphans = await db
    .select({ key: storeRequestAssets.key })
    .from(storeRequestAssets)
    .where(and(eq(storeRequestAssets.requestId, requestId), keep.length ? notInArray(storeRequestAssets.key, keep) : undefined));
  if (!orphans.length) return 0;
  const keys = orphans.map((o) => o.key);
  if (!(await deleteStoredFiles(keys))) return 0;
  await db.delete(storeRequestAssets).where(and(eq(storeRequestAssets.requestId, requestId), inArray(storeRequestAssets.key, keys)));
  return keys.length;
}

/**
 * حذف طلب نهائياً (بطلب العميل): الملفات أولاً ثم الصفوف (الأحداث والملفات تُحذف معه بالمفتاح الأجنبي). يعيد
 * false دون حذف أي صف إن تعذر حذف الملفات، حتى لا تبقى ملفات بلا سجل.
 */
export async function deleteRequestPermanently(requestId: string): Promise<boolean> {
  const rows = await db.select({ key: storeRequestAssets.key }).from(storeRequestAssets).where(eq(storeRequestAssets.requestId, requestId));
  if (!(await deleteStoredFiles(rows.map((r) => r.key)))) return false;
  await db.delete(storeRequests).where(eq(storeRequests.id, requestId));
  return true;
}
