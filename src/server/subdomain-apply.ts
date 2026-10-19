import "server-only";
// subdomain-apply.ts — تنفيذ تغيير النطاق الفرعي لمتجر (مسار واحد لتغيير التاجر من الإعدادات وتغيير الفريق من لوحة الإدارة):
// تحديث مشروط بالرابط الحالي (تغييران متزامنان لا يكتب أحدهما فوق الآخر)، حجز الرابط القديم 30 يوماً مع تحويل 308،
// إبطال الذاكرة المؤقتة للرابطين، ونقل خريطة النطاق الخاص. التحقق من الصيغة والتوفر على المستدعي (validateSubdomain + availability).
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { invalidateStoreCache } from "@/lib/tenant";
import { dbErrorInfo, PG_UNIQUE } from "@/lib/db-errors";
import { mapDomain, unmapDomain } from "@/server/domains";
import { nextPrevious } from "@/lib/subdomain-change";
import { writeSubdomainRedirects } from "@/server/subdomain-hold";

type RenameStore = { id: string; subdomain: string; prefs: unknown; customDomain: string | null; customDomainStatus: string | null };

export async function renameStoreSubdomain(store: RenameStore, next: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const old = store.subdomain;
  const previous = nextPrevious(store.prefs, old, next);
  try {
    const updated = await db
      .update(stores)
      .set({
        subdomain: next,
        prefs: sql`coalesce(${stores.prefs}, '{}'::jsonb) || ${JSON.stringify({ previousSubdomains: previous })}::jsonb`,
        updatedAt: new Date(),
      })
      .where(and(eq(stores.id, store.id), eq(stores.subdomain, old), isNull(stores.deletedAt)))
      .returning({ id: stores.id });
    if (!updated.length) return { ok: false, error: "تغيّر الرابط للتو من جلسة أخرى. حدّثوا الصفحة وحاولوا مجدداً." };
  } catch (e) {
    if (dbErrorInfo(e).code === PG_UNIQUE) return { ok: false, error: "هذا الرابط أُخذ للتو، جرّبوا اسماً آخر." };
    console.error("[renameStoreSubdomain]", e);
    return { ok: false, error: "تعذر الحفظ، حاولوا مرة أخرى." };
  }
  await writeSubdomainRedirects(next, previous);
  await invalidateStoreCache({ id: store.id, subdomain: old });
  await invalidateStoreCache({ id: store.id, subdomain: next });
  if (store.customDomain && store.customDomainStatus === "active") {
    await unmapDomain({ subdomain: old }, store.customDomain).catch(() => {});
    await mapDomain({ subdomain: next }, store.customDomain).catch((e) => console.error("[subdomain] custom domain remap failed", e));
  }
  return { ok: true };
}
