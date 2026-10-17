// store-purge.ts — حذف كل بيانات متجر من المنصة (الصفوف والصور)، مع إبقاء صف المتجر والتاجر
// (سجل الدفع وبريد التاجر). يُستدعى عند انتهاء التجربة بلا دفع (trial.purge) أو بطلب صاحب المتجر.
import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { stores, storeSecrets } from "@/db/schema";
import { unmapDomain, removeDomainHostnames } from "@/server/domains";
import { mediaApi } from "@/server/media-host";
import { mediaBaseUrl, r2KeyFromUrl } from "@/lib/media";
import { log } from "@/lib/logger";
import { PURGE_PLAN, MEDIA_FREE_TABLES, purgeTableName } from "./store-purge-plan";

type Store = typeof stores.$inferSelect;

const UT_MEDIA_RE = /https:\/\/(?:utfs\.io|[a-z0-9-]+\.ufs\.sh)\/[^\s"'<>)\\]+/gi;
const UT_KEY_RE = /https:\/\/(?:utfs\.io|[a-z0-9-]+\.ufs\.sh)\/f\/([^/?#"'\s]+)/gi;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** روابط ملفات المتجر: UploadThing القديمة، وروابط مساحة R2 إن ضُبطت. */
function mediaUrlsIn(text: string): string[] {
  const out = [...text.matchAll(UT_MEDIA_RE)].map((m) => m[0]);
  const base = mediaBaseUrl();
  if (base) out.push(...[...text.matchAll(new RegExp(`${escapeRe(base)}/[^\\s"'<>)\\\\]+`, "g"))].map((m) => m[0]));
  return out;
}

/** يحذف كل بيانات متجر من المنصة (الصفوف والصور). صف المتجر والتاجر يبقيان. */
export async function purgeStore(store: Store): Promise<boolean> {
  try {
    // مفاتيح الملفات أولاً (قبل حذف الصفوف التي تحمل روابطها).
    const keys = new Set<string>();
    for (const spec of PURGE_PLAN) {
      if (MEDIA_FREE_TABLES.has(purgeTableName(spec.table))) continue;
      const rows = await db.select().from(spec.table).where(spec.scope(store.id));
      const text = JSON.stringify(rows);
      for (const m of text.matchAll(UT_KEY_RE)) keys.add(m[1]!);
      for (const u of mediaUrlsIn(text)) {
        const k = r2KeyFromUrl(u);
        if (k) keys.add(k);
      }
    }
    // الحذف بعكس الترتيب: الجداول التابعة قبل ما تشير إليه.
    for (const spec of [...PURGE_PLAN].reverse()) await db.delete(spec.table).where(spec.scope(store.id));
    // أسرار التكاملات (رمز Conversions API) تُحذف مع المتجر.
    await db.delete(storeSecrets).where(eq(storeSecrets.storeId, store.id)).catch(() => {});
    // النطاق الخاص: يتوقف التوجيه إليه ويتحرر لغيره.
    if (store.customDomain) {
      await unmapDomain(store, store.customDomain).catch(() => {});
      await removeDomainHostnames(store.customDomain).catch(() => {});
      await db.update(stores).set({ customDomain: null, customDomainStatus: null }).where(eq(stores.id, store.id)).catch(() => {});
    }
    if (keys.size) {
      const api = await mediaApi();
      // الصفوف حُذفت بالفعل؛ فشل حذف الملفات يُسجَّل ولا يوقف إنهاء الحذف (إعادة المحاولة لن تجد مفاتيحها).
      if (!api || !(await api.remove([...keys]).catch(() => false))) log.error("store", "purge_media_failed", { storeId: store.id, files: keys.size }, "");
    }
    await db.update(stores).set({ purgedAt: new Date() }).where(and(eq(stores.id, store.id), isNull(stores.purgedAt)));
    log.info("store", "store_purged", { storeId: store.id, files: keys.size });
    return true;
  } catch (e) {
    log.error("store", "store_purge_failed", { storeId: store.id }, "", e);
    return false;
  }
}
