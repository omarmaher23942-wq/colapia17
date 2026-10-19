"use server";

// subdomain.ts — «الإعدادات ← رابط المتجر» (V3 D1): صاحب المتجر وحده يغيّر النطاق الفرعي. الرابط الجديد فريد وغير محجوز،
// والقديم يحوّل 308 للجديد مدة 30 يوماً (ولا يأخذه متجر آخر خلالها)، بحد 3 تغييرات كل 30 يوماً، مع إبطال الذاكرة المؤقتة
// ونقل خريطة النطاق الخاص إن كان مفعّلاً. متجر خصّصه فريقنا بمجلد باسم رابطه يُغيَّر رابطه عبر الفريق.
import { revalidatePath } from "next/cache";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { storeActivity, stores } from "@/db/schema";
import { isStoreOwner, ownerStore, storeFor } from "@/server/merchant-guard";
import { invalidateStoreCache } from "@/lib/tenant";
import { hit } from "@/lib/rate-hit";
import { clientEnv } from "@/lib/env";
import { storeUrl } from "@/lib/utils";
import { dbErrorInfo, PG_UNIQUE } from "@/lib/db-errors";
import { storeEntry } from "@/stores/resolve";
import { mapDomain, unmapDomain } from "@/server/domains";
import { activePrevious, MAX_CHANGES_PER_30D, nextPrevious, REDIRECT_DAYS, validateSubdomain, type PreviousSubdomain } from "@/lib/subdomain-change";
import { isSubdomainHeld, writeSubdomainRedirects } from "@/server/subdomain-hold";

export type SubdomainInfo = {
  subdomain: string;
  url: string;
  root: string;
  canChange: boolean;
  /** سبب عدم إمكان التغيير (للعرض). */
  reason: string | null;
  previous: PreviousSubdomain[];
  redirectDays: number;
  customDomain: string | null;
};

type Result = { ok: true; subdomain: string; url: string } | { ok: false; error: string };

const changesKey = (storeId: string) => `subdomain-change:${storeId}`;

export async function subdomainInfoAction(): Promise<SubdomainInfo | null> {
  const s = await storeFor("settings", "view");
  if (!s) return null;
  const owner = isStoreOwner(s);
  const custom = s.store.customDomain && s.store.customDomainStatus === "active" ? s.store.customDomain : null;
  const reason = !owner
    ? "تغيير رابط المتجر لصاحب المتجر وحده."
    : storeEntry(s.store.subdomain)
      ? "تصميم متجركم مخصص من فريقنا ومرتبط برابطه الحالي. لتغيير الرابط راسلونا وسننقله لكم دون أن يتأثر شيء."
      : null;
  return {
    subdomain: s.store.subdomain,
    url: storeUrl(s.store.subdomain),
    root: clientEnv.NEXT_PUBLIC_ROOT_DOMAIN,
    canChange: !reason,
    reason,
    previous: activePrevious(s.store.prefs),
    redirectDays: REDIRECT_DAYS,
    customDomain: custom,
  };
}

async function availability(sub: string, storeId: string): Promise<string | null> {
  const [taken] = await db.select({ id: stores.id }).from(stores).where(and(eq(stores.subdomain, sub), ne(stores.id, storeId))).limit(1);
  if (taken) return "هذا الرابط مستخدم لمتجر آخر، جرّبوا اسماً آخر.";
  if (storeEntry(sub)) return "هذا الرابط محجوز، جرّبوا اسماً آخر.";
  if (await isSubdomainHeld(sub, storeId)) return "هذا الرابط محجوز مؤقتاً، جرّبوا اسماً آخر.";
  return null;
}

/** فحص التوفر أثناء الكتابة (بلا حفظ). */
export async function checkSubdomainAction(raw: string): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  const s = await ownerStore();
  if (!s) return { ok: false, error: "تغيير رابط المتجر لصاحب المتجر وحده." };
  if (!(await hit(`subdomain-check:${s.storeId}`, 60, 600))) return { ok: false, error: "محاولات كثيرة، انتظروا دقائق ثم جرّبوا." };
  const v = validateSubdomain(String(raw ?? ""), s.store.subdomain, clientEnv.NEXT_PUBLIC_ROOT_DOMAIN);
  if (!v.ok) return v;
  const err = await availability(v.value, s.storeId);
  return err ? { ok: false, error: err } : { ok: true, value: v.value };
}

export async function changeSubdomainAction(raw: string): Promise<Result> {
  const s = await ownerStore();
  if (!s) return { ok: false, error: "تغيير رابط المتجر لصاحب المتجر وحده." };
  const old = s.store.subdomain;
  if (storeEntry(old)) return { ok: false, error: "تصميم متجركم مخصص من فريقنا ومرتبط برابطه الحالي. راسلونا لتغييره." };
  if (s.store.status === "deleted" || s.store.status === "suspended") return { ok: false, error: "لا يمكن تغيير رابط هذا المتجر الآن." };

  const v = validateSubdomain(String(raw ?? ""), old, clientEnv.NEXT_PUBLIC_ROOT_DOMAIN);
  if (!v.ok) return v;
  const next = v.value;
  const err = await availability(next, s.storeId);
  if (err) return { ok: false, error: err };
  if (!(await hit(changesKey(s.storeId), MAX_CHANGES_PER_30D, 30 * 86_400))) {
    return { ok: false, error: `وصلتم للحد: ${MAX_CHANGES_PER_30D} تغييرات للرابط خلال 30 يوماً. الرابط يُنشر في البايو والإعلانات، وتغييره المتكرر يربك العملاء.` };
  }

  const previous = nextPrevious(s.store.prefs, old, next);
  try {
    const updated = await db
      .update(stores)
      .set({
        subdomain: next,
        prefs: sql`coalesce(${stores.prefs}, '{}'::jsonb) || ${JSON.stringify({ previousSubdomains: previous })}::jsonb`,
        updatedAt: new Date(),
      })
      // شرط القراءة نفسها: تغييران متزامنان لا يكتب أحدهما فوق الآخر.
      .where(and(eq(stores.id, s.storeId), eq(stores.subdomain, old), isNull(stores.deletedAt)))
      .returning({ id: stores.id });
    if (!updated.length) return { ok: false, error: "تغيّر الرابط للتو من جلسة أخرى. حدّثوا الصفحة وحاولوا مجدداً." };
  } catch (e) {
    if (dbErrorInfo(e).code === PG_UNIQUE) return { ok: false, error: "هذا الرابط أُخذ للتو، جرّبوا اسماً آخر." };
    console.error("[changeSubdomainAction]", e);
    return { ok: false, error: "تعذر الحفظ، حاولوا مرة أخرى." };
  }

  // التحويل من كل رابط قديم ساري إلى الجديد، ثم الذاكرة المؤقتة للرابطين، ثم خريطة النطاق الخاص.
  await writeSubdomainRedirects(next, previous);
  await invalidateStoreCache({ id: s.storeId, subdomain: old });
  await invalidateStoreCache({ id: s.storeId, subdomain: next });
  if (s.store.customDomain && s.store.customDomainStatus === "active") {
    await unmapDomain({ subdomain: old }, s.store.customDomain).catch(() => {});
    await mapDomain({ subdomain: next }, s.store.customDomain).catch((e) => console.error("[subdomain] custom domain remap failed", e));
  }
  await db.insert(storeActivity).values({ storeId: s.storeId, merchantId: s.merchantId ?? null, action: "store.subdomain_changed", target: `${old} → ${next}` }).catch(() => {});

  revalidatePath("/dashboard", "layout");
  return { ok: true, subdomain: next, url: storeUrl(next) };
}
