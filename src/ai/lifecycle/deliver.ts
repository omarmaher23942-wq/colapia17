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
import { env, clientEnv } from "@/lib/env";
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
  by: string
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
  const demoMinutes = env.TRIAL_ACTIVE_MINUTES || 480;
  const demoExpiresAt = new Date(now.getTime() + demoMinutes * 60_000);
  const trialEndsAt = new Date(now.getTime() + env.TRIAL_HOURS * 36e5);

  const r = await transition({
    storeId,
    to: "trial",
    from: ["review", "building"],
    actor: by === "auto" ? "timer" : by,
    set: {
      deliveredAt: now,
      demoStartedAt: now,
      demoExpiresAt,
      trialEndsAt,
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
    await scheduleTrial(storeId, now);
    await schedulePaymentInvite(storeId, now);
  });

  await safe("message", storeId, async () => {
    const [bp] = await db
      .select()
      .from(storeBlueprints)
      .where(eq(storeBlueprints.storeId, storeId))
      .limit(1);
    const brand = bp?.data.brand.name ?? s.name;
    const url = storeUrl(s.subdomain, "?preview=owner");
    const welcome = await renderTemplate("delivery.welcome", {
      store: brand,
      store_url: url,
      magic_url: magicUrl,
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