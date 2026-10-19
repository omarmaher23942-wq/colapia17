import "server-only";
// subdomain-hold.ts — الروابط القديمة للمتاجر (بعد تغيير الرابط من الإعدادات) محجوزة لأصحابها 30 يوماً وتحوّل للجديد.
// المصدر الدائم stores.prefs.previousSubdomains، والوسيط يقرأ نسخة سريعة في Redis (sdr:<القديم> = الجديد بمدة انتهاء).
import { and, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { redis } from "@/lib/redis";
import { activePrevious, subdomainRedirectKey, ttlSeconds, type PreviousSubdomain } from "@/lib/subdomain-change";

/** هل الرابط محجوز لمتجر آخر (رابط قديم ما زال يحوّل)؟ يفحص القاعدة (الدائم) لا Redis وحده. */
export async function isSubdomainHeld(sub: string, exceptStoreId?: string): Promise<boolean> {
  const rows = await db
    .select({ prefs: stores.prefs })
    .from(stores)
    .where(
      and(
        exceptStoreId ? ne(stores.id, exceptStoreId) : undefined,
        sql`${stores.prefs}->'previousSubdomains' @> ${JSON.stringify([{ sub }])}::jsonb`
      )
    )
    .limit(5)
    .catch(() => [] as { prefs: Record<string, unknown> }[]);
  return rows.some((r) => activePrevious(r.prefs).some((p) => p.sub === sub));
}

/** يكتب مفاتيح التحويل لكل رابط قديم ما زال سارياً نحو الرابط الحالي، ويحذف مفتاح الرابط الحالي إن كان قديماً من قبل. */
export async function writeSubdomainRedirects(current: string, previous: PreviousSubdomain[]): Promise<void> {
  await redis.del(subdomainRedirectKey(current)).catch(() => {});
  for (const p of previous) {
    await redis.set(subdomainRedirectKey(p.sub), current, { ex: ttlSeconds(p.until) }).catch((e) => console.error("[subdomain] redirect write failed", e));
  }
}
