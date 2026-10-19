"use server";

// subdomain.ts — «الإعدادات ← رابط المتجر» (V3 D1): صاحب المتجر وحده يغيّر النطاق الفرعي. الرابط الجديد فريد وغير محجوز،
// والقديم يحوّل 308 للجديد مدة 30 يوماً (ولا يأخذه متجر آخر خلالها)، بحد 3 تغييرات كل 30 يوماً، مع إبطال الذاكرة المؤقتة
// ونقل خريطة النطاق الخاص إن كان مفعّلاً. متجر خصّصه فريقنا بمجلد باسم رابطه يُغيَّر رابطه عبر الفريق.
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { storeActivity, stores } from "@/db/schema";
import { isStoreOwner, ownerStore, storeFor } from "@/server/merchant-guard";
import { hit } from "@/lib/rate-hit";
import { clientEnv } from "@/lib/env";
import { storeUrl } from "@/lib/utils";
import { storeEntry } from "@/stores/resolve";
import { activePrevious, MAX_CHANGES_PER_30D, REDIRECT_DAYS, validateSubdomain, type PreviousSubdomain } from "@/lib/subdomain-change";
import { isSubdomainHeld } from "@/server/subdomain-hold";
import { renameStoreSubdomain } from "@/server/subdomain-apply";

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

  const done = await renameStoreSubdomain({ id: s.storeId, subdomain: old, prefs: s.store.prefs, customDomain: s.store.customDomain, customDomainStatus: s.store.customDomainStatus }, next);
  if (!done.ok) return done;
  await db.insert(storeActivity).values({ storeId: s.storeId, merchantId: s.merchantId ?? null, action: "store.subdomain_changed", target: `${old} → ${next}` }).catch(() => {});

  revalidatePath("/dashboard", "layout");
  return { ok: true, subdomain: next, url: storeUrl(next) };
}
