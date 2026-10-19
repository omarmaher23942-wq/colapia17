import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  conversations,
  magicLinks,
  merchants,
  storeBlueprints,
  stores,
} from "@/db/schema";
import { clientEnv } from "@/lib/env";
import { storeUrl } from "@/lib/utils";
import { secureToken, sha256 } from "@/lib/ids";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { transition } from "@/lifecycle/machine";
import {
  cancelJobs,
  schedulePaymentInvite,
  scheduleTrial,
} from "@/lifecycle/scheduler";
import { deliverToMerchant } from "@/lifecycle/messenger";
import { renderTemplate } from "@/lifecycle/templates";
import { MAGIC_LINK_TTL_HOURS } from "@/lifecycle/config";
import { lifecycleTimings, type LifecycleTimings } from "@/lifecycle/timings";
import { trialSchedule } from "@/lifecycle/timings-rules";
import { currentPricing } from "@/server/pricing";
import { activationUrl } from "@/server/claims";

export async function issueMagicLink(
  store: { id: string; subdomain: string; merchantId: string },
  ttlHours = MAGIC_LINK_TTL_HOURS
): Promise<string> {
  const token = secureToken();
  await db.insert(magicLinks).values({
    tokenHash: await sha256(token),
    purpose: "activate",
    merchantId: store.merchantId,
    storeId: store.id,
    expiresAt: new Date(Date.now() + ttlHours * 36e5),
  });
  return activationUrl(token);
}

async function safe(
  label: string,
  storeId: string,
  fn: () => Promise<unknown>
) {
  try {
    await fn();
  } catch (e) {
    console.error(`[deliver] ${label}`, e);
    await notifyAdmin(
      `خطأ في مرحلة التسليم (${label}) للمتجر ${storeId}`,
      { storeId, error: String(e).slice(0, 300) }
    ).catch(() => {});
  }
}

export async function deliverStore(
  storeId: string,
  by: string,
  opts: { timings?: LifecycleTimings } = {}
): Promise<boolean> {
  const [s] = await db
    .select()
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);
  if (!s || (s.status !== "review" && s.status !== "building")) return false;

  const [m] = await db
    .select({ isActivated: merchants.isActivated })
    .from(merchants)
    .where(eq(merchants.id, s.merchantId))
    .limit(1);

  // إن كان التاجر مفعّلاً بالفعل → رابط مباشر للداشبورد على النطاق الجذر.
  // إن لم يكن → رابط تفعيل /claim يستلم به المتجر بعد الدخول بحساب Google.
  const magicUrl = m?.isActivated
    ? `${clientEnv.NEXT_PUBLIC_APP_URL}/dashboard`
    : await issueMagicLink(s);

  const now = new Date();
  const timings = opts.timings ?? (await lifecycleTimings());
  const plan = trialSchedule(now, timings);
  const trialEndsAt = plan.freeze;
  // السعر يُثبَّت للمتجر لحظة التسليم (سلّم الأسعار): هذا ما رآه العميل في بريد التسليم ويدفعه.
  const pricing = await currentPricing();
  const price = pricing.build.price;

  const r = await transition({
    storeId,
    to: "trial",
    from: ["review", "building"],
    actor: by === "auto" ? "timer" : by,
    set: {
      deliveredAt: now,
      demoStartedAt: now,
      demoExpiresAt: trialEndsAt,
      trialEndsAt,
      purgeAt: plan.purge,
      priceLockedEgp: s.priceLockedEgp ?? price,
    },
    reason: "delivered",
  });
  if (!r.ok) return false;

  await safe("cancel_auto", storeId, () =>
    cancelJobs(storeId, ["delivery.auto"])
  );
  await safe("stage", storeId, () =>
    db
      .update(conversations)
      .set({ stage: "delivered", updatedAt: now })
      .where(eq(conversations.storeId, storeId))
  );
  await safe("schedule", storeId, async () => {
    await scheduleTrial(storeId, now, timings);
    await schedulePaymentInvite(storeId, now);
  });

  await safe("message", storeId, async () => {
    const [bp] = await db
      .select()
      .from(storeBlueprints)
      .where(eq(storeBlueprints.storeId, storeId))
      .limit(1);
    const brand = bp?.data.brand.name ?? s.name;
    const url = storeUrl(s.subdomain);
    const welcome = await renderTemplate("delivery.welcome", {
      store: brand,
      store_url: url,
      magic_url: magicUrl,
      trial_hours: timings.trialHours,
    });

    await deliverToMerchant(storeId, {
      key: `delivery.welcome:${storeId}`,
      text: welcome.text,
      purpose: "transactional",
      buttons: [
        { title: "افتح متجرك الحي", url },
        { title: "لوحة التحكم الخاصة بك", url: magicUrl },
      ],
      email: { subject: `متجرك ${brand} جاهز وشغال الآن` },
    });

    const guide = await renderTemplate("delivery.guide");
    await deliverToMerchant(storeId, {
      key: `delivery.guide:${storeId}`,
      text: guide.text,
      purpose: "transactional",
    });
  });

  await notifyAdmin(
    `تم تسليم متجر ${s.subdomain} للتاجر بنجاح (${by}) 🚀`,
    { storeId }
  ).catch(() => {});
  return true;
}

/**
 * بدء التجربة بعد إكمال التاجر «إعداد المتجر» (V2): المتجر من `setup` إلى `trial` فور التفعيل. لا رسالة تسليم
 * (التاجر داخل الموقع أصلاً): الانتقال ذري، ثم جدولة تذكيرات التجربة والدفع. تفعيل مكرر لا يبدأ تجربتين.
 */
export async function startTrial(
  storeId: string,
  by: string,
  opts: { timings?: LifecycleTimings } = {}
): Promise<{ ok: true; trialEndsAt: Date } | { ok: false; reason: "not_found" | "not_allowed" | "stale" }> {
  const [s] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!s) return { ok: false, reason: "not_found" };

  const now = new Date();
  const timings = opts.timings ?? (await lifecycleTimings());
  const plan = trialSchedule(now, timings);
  const pricing = await currentPricing();
  const price = pricing.build.price;

  const r = await transition({
    storeId,
    to: "trial",
    from: ["setup"],
    actor: by,
    set: {
      setupCompletedAt: now,
      deliveredAt: now,
      demoStartedAt: now,
      demoExpiresAt: plan.freeze,
      trialEndsAt: plan.freeze,
      purgeAt: plan.purge,
      priceLockedEgp: s.priceLockedEgp ?? price,
    },
    reason: "setup_completed",
  });
  if (!r.ok) return { ok: false, reason: r.reason };

  await safe("stage", storeId, () => db.update(conversations).set({ stage: "delivered", updatedAt: now }).where(eq(conversations.storeId, storeId)));
  await safe("schedule", storeId, async () => {
    await scheduleTrial(storeId, now, timings);
    await schedulePaymentInvite(storeId, now);
  });
  await notifyAdmin(`أكمل التاجر إعداد متجر ${s.subdomain} وبدأت تجربته`, { storeId }).catch(() => {});
  return { ok: true, trialEndsAt: plan.freeze };
}