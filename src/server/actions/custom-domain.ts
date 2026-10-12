"use server";
// custom-domain.ts — صاحب المتجر يربط نطاقه الخاص (المرحلة 7): يكتبه ← يُضاف لمشروع Vercel آلياً (أو ينتظر إضافة
// الفريق يدوياً) ← يرى السجلات المطلوبة وحالة حية ← عند الإشارة إلينا يُفعَّل والنطاق الفرعي يحوّل إليه.
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { ownerStore } from "@/server/merchant-guard";
import { normalizeDomain } from "@/lib/custom-domain";
import { addToVercel, checkStoreDomain, removeFromVercel, unmapDomain } from "@/server/domains";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { allow } from "@/lib/ratelimit";

type Result = { ok: true; status?: string } | { ok: false; error: string };

const refresh = () => revalidatePath("/dashboard/domain");

export async function setCustomDomainAction(raw: string): Promise<Result> {
  const s = await ownerStore();
  if (!s) return { ok: false, error: "ربط النطاق لصاحب المتجر." };
  if (!["trial", "active"].includes(s.store.status)) return { ok: false, error: "يُربط النطاق بعد تسليم المتجر." };
  if (!(await allow("ownership", `domain:${s.storeId}`))) return { ok: false, error: "محاولات كثيرة، انتظر دقائق." };
  const domain = normalizeDomain(raw, process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "colapia.com");
  if (!domain) return { ok: false, error: "اكتب النطاق فقط مثل mystore.com أو shop.mystore.com." };
  const [taken] = await db.select({ id: stores.id }).from(stores).where(and(eq(stores.customDomain, domain), ne(stores.id, s.storeId))).limit(1);
  if (taken) return { ok: false, error: "هذا النطاق مربوط بمتجر آخر." };
  if (s.store.customDomain && s.store.customDomain !== domain) {
    await unmapDomain(s.store, s.store.customDomain).catch(() => {});
    await removeFromVercel(s.store.customDomain).catch(() => {});
  }
  await db.update(stores).set({ customDomain: domain, customDomainStatus: "pending", customDomainVerifiedAt: null, updatedAt: new Date() }).where(eq(stores.id, s.storeId));
  const added = await addToVercel(domain);
  if (!added.ok && added.error === "manual") {
    await notifyAdmin(`نطاق خاص جديد بانتظار إضافته في Vercel: ${domain} لمتجر ${s.store.subdomain}. أضفه من Settings ← Domains ثم «أكّد الإضافة» في صفحة المتجر.`, { storeId: s.storeId }).catch(() => {});
  } else if (!added.ok) {
    // لا نترك النطاق محجوزاً لهذا المتجر بعد فشل التسجيل.
    await db.update(stores).set({ customDomain: null, customDomainStatus: null, updatedAt: new Date() }).where(eq(stores.id, s.storeId)).catch(() => {});
    return { ok: false, error: "تعذر تسجيل النطاق الآن، حاول لاحقاً أو تواصل معنا." };
  }
  const [fresh] = await db.select().from(stores).where(eq(stores.id, s.storeId)).limit(1);
  const r = fresh ? await checkStoreDomain(fresh) : null;
  refresh();
  return { ok: true, status: r?.status };
}

export async function checkCustomDomainAction(): Promise<Result> {
  const s = await ownerStore();
  if (!s?.store.customDomain) return { ok: false, error: "لا نطاق مربوط." };
  if (!(await allow("search", `domain-check:${s.storeId}`))) return { ok: false, error: "انتظر قليلاً قبل الفحص التالي." };
  const r = await checkStoreDomain(s.store);
  refresh();
  return { ok: true, status: r.status };
}

export async function removeCustomDomainAction(): Promise<Result> {
  const s = await ownerStore();
  if (!s?.store.customDomain) return { ok: false, error: "لا نطاق مربوط." };
  await unmapDomain(s.store, s.store.customDomain).catch(() => {});
  await removeFromVercel(s.store.customDomain).catch(() => {});
  await db.update(stores).set({ customDomain: null, customDomainStatus: null, customDomainVerifiedAt: null, customDomainCheckedAt: null, updatedAt: new Date() }).where(eq(stores.id, s.storeId));
  refresh();
  return { ok: true };
}

