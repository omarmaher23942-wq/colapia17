import "server-only";
import { and, count, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, platformPayments, stores } from "@/db/schema";
import { env } from "@/lib/env";
import { storeUrl } from "@/lib/utils";
import { invalidateStoreCache } from "@/lib/tenant";
import {
  cancelJobs,
  scheduleDoom,
  scheduleHosting,
  type JobKind,
} from "./scheduler";
import { DEFAULT_PLAN_MONTHS, addMonths, extendHosting, hostingExpiry } from "@/lib/hosting";
import { monthsLabel, planById, planIdFrom } from "@/lib/platform-pricing";
import { currentPricing } from "@/server/pricing";
import { recordEvent, transition } from "./machine";
import { deliverToMerchant } from "./messenger";
import { formatDay, paymentVars, renderTemplate } from "./templates";
import { emitPaymentConfirmed } from "@/server/realtime/emitters";

const HOSTING_JOBS: JobKind[] = ["hosting.reminder_30d", "hosting.reminder_7d", "hosting.reminder_1d", "hosting.expired", "hosting.paused"];

const TRIAL_JOBS: JobKind[] = [
  "trial.reminder_6h",
  "trial.reminder_20h",
  "trial.freeze",
  "trial.last_chance",
  "trial.purge",
  "payment.invite",
];

async function revert(paymentId: string) {
  await db
    .update(platformPayments)
    .set({
      status: "under_review",
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
    })
    .where(eq(platformPayments.id, paymentId));
}

/** reviewerId = null يعني قبولاً فورياً آلياً (يظهر في لوحة المالك للمراجعة وقابل للإلغاء). */
export async function confirmStorePayment(
  paymentId: string,
  reviewerId: string | null,
  note?: string
): Promise<{ ok: true }> {
  const now = new Date();
  const [pay] = await db
    .update(platformPayments)
    .set({
      status: "confirmed",
      reviewedBy: reviewerId,
      reviewedAt: now,
      reviewNote: note ?? null,
    })
    .where(
      and(
        eq(platformPayments.id, paymentId),
        eq(platformPayments.status, "under_review")
      )
    )
    .returning();
  if (!pay) throw new Error("الدفعة رُوجعت من قبل أو غير موجودة");

  const [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.id, pay.storeId))
    .limit(1);
  if (!store) {
    await revert(paymentId);
    throw new Error("المتجر غير موجود");
  }

  const actor = reviewerId ? `owner:${reviewerId}` : "auto:instant";
  let cur = store.status;

  if (cur === "deleted") {
    const r = await transition({
      storeId: store.id,
      to: "frozen",
      from: ["deleted"],
      actor,
      set: { deletedAt: null },
      reason: "payment_after_delete",
      data: { paymentId },
    });
    if (!r.ok) {
      await revert(paymentId);
      throw new Error("تعذّر استرجاع المتجر المحذوف");
    }
    cur = "frozen";
  }

  // القرار يثق بما سُجّل على الدفعة نفسها (نوعها وخطتها ومدتها)، لا بالكود أو الأسعار الحالية.
  const renewal = pay.kind === "renewal";
  const golden = pay.plan === "golden";
  const months = pay.months && pay.months > 0 ? pay.months : DEFAULT_PLAN_MONTHS;
  if (renewal && cur !== "active") {
    await revert(paymentId);
    throw new Error("هذه دفعة تجديد، والمتجر غير مفعّل بعد: راجعوا نوع الدفعة");
  }
  if (golden && renewal) {
    await revert(paymentId);
    throw new Error("الدائرة الذهبية للباقة الأولى فقط");
  }
  const pricing = await currentPricing();
  if (golden) {
    // مقاعد الدائرة الذهبية: لا يتجاوز عدد الدفعات المؤكدة بها العدد المحدد وقت القبول.
    const offer = pricing.golden;
    const [taken] = await db
      .select({ n: count() })
      .from(platformPayments)
      .where(and(eq(platformPayments.plan, "golden"), eq(platformPayments.status, "confirmed"), ne(platformPayments.id, paymentId)));
    if (Number(taken?.n ?? 0) >= offer.seats) {
      await revert(paymentId);
      throw new Error(`اكتملت مقاعد الدائرة الذهبية (${offer.seats}). ارفضوا الدفعة أو زيدوا المقاعد من صفحة الأسعار`);
    }
  }
  // التمديد بمدة الدفعة: من نهاية الاشتراك الحالي إن كان سارياً، وإلا من اليوم.
  const expiresAt = extendHosting(renewal ? hostingExpiry(store) : null, months, now);
  // باقة الاستضافة المسجّلة على الدفعة (دفعة قديمة بلا باقة = «النمو»): حدود المتجر تُقرأ منها (server/usage.ts).
  const tier = planIdFrom(pay.tier) ?? "growth";
  const tierName = planById(pricing, tier)?.name ?? tier;
  const planSet = { plan: tier, planMonths: months };

  if (!renewal) {
    const r = await transition({
      storeId: store.id,
      to: "active",
      from: ["trial", "frozen"],
      actor,
      set: {
        activatedAt: store.activatedAt ?? now,
        hostingExpiresAt: expiresAt,
        ...planSet,
        frozenAt: null,
        purgeAt: null,
        doomAt: null,
      },
      reason: "payment_confirmed",
      data: { paymentId },
    });
    if (!r.ok) {
      await revert(paymentId);
      throw new Error(
        `حالة المتجر الحالية (${
          r.ok === false && r.current ? r.current : cur
        }) لا تسمح بالتفعيل`
      );
    }
  } else {
    const [renewed] = await db
      .update(stores)
      .set({ hostingExpiresAt: expiresAt, ...planSet, updatedAt: now })
      .where(eq(stores.id, store.id))
      .returning();
    if (renewed) await invalidateStoreCache(renewed).catch(() => {});
  }
  await db.update(platformPayments).set({ coversUntil: expiresAt, months }).where(eq(platformPayments.id, paymentId));
  // تذكيرات التجديد (قبل الانتهاء بـ30 و7 أيام ويوم، ثم عند الانتهاء، ثم عند الإيقاف). تجديد لاحق يعيد جدولتها.
  await scheduleHosting(store.id, expiresAt).catch((e) => console.error("[payments] schedule hosting jobs failed", e));

  await db
    .update(conversations)
    .set({ stage: "activated", updatedAt: now })
    .where(eq(conversations.storeId, store.id))
    .catch(() => {});

  await recordEvent({
    storeId: store.id,
    storeRef: store.subdomain,
    type: "payment.confirmed",
    actor,
    data: { paymentId, kind: renewal ? "renewal" : "setup", plan: tier, golden, months, hostingExpiresAt: expiresAt.toISOString() },
  });

  // حدث Pusher: تأكيد الدفعة.
  void emitPaymentConfirmed(store.id, {
    paymentId,
    storeId: store.id,
    amountPiasters: pay.amountPiasters,
    confirmedAt: now.toISOString(),
    confirmedBy: actor,
  });

  const { text } = await renderTemplate(renewal ? "hosting.renewed" : golden ? "payment.golden" : "payment.confirmed", {
    store: store.name,
    store_url: storeUrl(store.subdomain),
    expires: formatDay(expiresAt),
    months: monthsLabel(months),
    plan: tierName,
  });
  await deliverToMerchant(store.id, {
    key: `payment.confirmed:${paymentId}`,
    text,
    purpose: "transactional",
    email: { subject: renewal ? "تم تجديد استضافة متجركم" : golden ? "تم تفعيل متجركم ضمن «الدائرة الذهبية»" : "تم تأكيد الدفع وتفعيل متجركم" },
  });
  return { ok: true };
}

export async function rejectStorePayment(
  paymentId: string,
  reviewerId: string,
  note?: string
): Promise<{ ok: true; doomAt: string | null }> {
  const [pay] = await db
    .select()
    .from(platformPayments)
    .where(eq(platformPayments.id, paymentId))
    .limit(1);
  if (!pay || pay.status !== "under_review")
    throw new Error("الدفعة رُوجعت من قبل أو غير موجودة");

  const [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.id, pay.storeId))
    .limit(1);
  if (!store) throw new Error("المتجر غير موجود");
  const renewal = pay.kind === "renewal";
  if (!renewal && store.status !== "trial" && store.status !== "frozen")
    throw new Error(`لا يمكن رفض دفعة لمتجر في حالة ${store.status}`);

  const now = new Date();
  const [claimed] = await db
    .update(platformPayments)
    .set({
      status: "rejected",
      reviewedBy: reviewerId,
      reviewedAt: now,
      reviewNote: note ?? null,
    })
    .where(
      and(
        eq(platformPayments.id, paymentId),
        eq(platformPayments.status, "under_review")
      )
    )
    .returning({ id: platformPayments.id });
  if (!claimed) throw new Error("الدفعة رُوجعت من قبل");

  if (renewal) {
    // رفض تجديد: الاشتراك الحالي كما هو، بلا تجميد ولا مهلة حذف.
    const expires = hostingExpiry(store);
    await recordEvent({
      storeId: store.id,
      storeRef: store.subdomain,
      type: "payment.rejected",
      actor: `owner:${reviewerId}`,
      data: { paymentId, kind: "renewal", note: note ?? null },
    });
    const { text } = await renderTemplate("hosting.renewal_revoked", {
      store: store.name,
      expires: expires ? formatDay(expires) : "",
      reason_line: note ? ` السبب: ${note}` : "",
      activate_url: (await paymentVars(store)).activate_url,
    });
    await deliverToMerchant(store.id, {
      key: `payment.rejected:${paymentId}`,
      text,
      purpose: "transactional",
      email: { subject: "بخصوص إيصال التجديد" },
    });
    return { ok: true, doomAt: null };
  }

  const doomAt =
    store.doomAt && store.doomAt.getTime() > now.getTime()
      ? store.doomAt
      : new Date(now.getTime() + env.DOOM_HOURS * 36e5);
  const [updated] = await db
    .update(stores)
    .set({ doomAt, updatedAt: now })
    .where(eq(stores.id, store.id))
    .returning();
  await cancelJobs(store.id, TRIAL_JOBS).catch((e) =>
    // eslint-disable-next-line no-console
    console.error("[payments] cancel trial jobs failed", e)
  );
  await scheduleDoom(store.id, doomAt);
  if (updated) await invalidateStoreCache(updated).catch(() => {});

  const actor = `owner:${reviewerId}`;
  await recordEvent({
    storeId: store.id,
    storeRef: store.subdomain,
    type: "payment.rejected",
    actor,
    data: {
      paymentId,
      doomAt: doomAt.toISOString(),
      note: note ?? null,
    },
  });

  const hours = Math.max(
    1,
    Math.round((doomAt.getTime() - now.getTime()) / 36e5)
  );
  const { text } = await renderTemplate("payment.rejected", {
    ...(await paymentVars(store)),
    hours,
    reason_line: note ? ` السبب: ${note}` : "",
  });
  await deliverToMerchant(store.id, {
    key: `payment.rejected:${paymentId}`,
    text,
    purpose: "transactional",
    email: { subject: "بخصوص إيصال التحويل" },
  });
  return { ok: true, doomAt: doomAt.toISOString() };
}
/**
 * إلغاء دفعة قُبلت ثم تبيّن عند المراجعة أن التحويل لم يصل.
 *  - تجديد: يعود تاريخ انتهاء الاستضافة إلى ما غطته الدفعة المؤكدة السابقة (بلا تجميد ولا مهلة حذف).
 *  - باقة أولى (عادية أو ذهبية): يعود المتجر للتجميد بمهلة، وتُمسح الخطة والمدة.
 */
export async function revokeStorePayment(
  paymentId: string,
  reviewerId: string,
  note: string
): Promise<{ ok: true; doomAt: string | null; hostingExpiresAt?: string | null }> {
  const [pay] = await db.select().from(platformPayments).where(eq(platformPayments.id, paymentId)).limit(1);
  if (!pay || pay.status !== "confirmed") throw new Error("الدفعة ليست مؤكدة");
  const [store] = await db.select().from(stores).where(eq(stores.id, pay.storeId)).limit(1);
  if (!store) throw new Error("المتجر غير موجود");

  const now = new Date();
  const [claimed] = await db
    .update(platformPayments)
    .set({ status: "rejected", reviewedBy: reviewerId, reviewedAt: now, reviewNote: note })
    .where(and(eq(platformPayments.id, paymentId), eq(platformPayments.status, "confirmed")))
    .returning({ id: platformPayments.id });
  if (!claimed) throw new Error("الدفعة تغيّرت قبل قليل");
  const actor = `owner:${reviewerId}`;

  if (pay.kind === "renewal") {
    // آخر دفعة مؤكدة أخرى لهذا المتجر هي ما يغطي الاشتراك الآن.
    const [prev] = await db
      .select()
      .from(platformPayments)
      .where(and(eq(platformPayments.storeId, store.id), eq(platformPayments.status, "confirmed"), ne(platformPayments.id, paymentId)))
      .orderBy(desc(platformPayments.coversUntil), desc(platformPayments.createdAt))
      .limit(1);
    const months = pay.months && pay.months > 0 ? pay.months : DEFAULT_PLAN_MONTHS;
    const current = hostingExpiry(store);
    const rolledBack = prev?.coversUntil ?? (current ? addMonths(current, -months) : null);
    const [updated] = await db
      .update(stores)
      .set({
        hostingExpiresAt: rolledBack,
        plan: prev?.tier ?? planIdFrom(store.plan) ?? "growth",
        planMonths: prev ? prev.months ?? DEFAULT_PLAN_MONTHS : store.planMonths,
        updatedAt: now,
      })
      .where(eq(stores.id, store.id))
      .returning();
    if (updated) await invalidateStoreCache(updated).catch(() => {});
    if (rolledBack) await scheduleHosting(store.id, rolledBack).catch((e) => console.error("[payments] reschedule hosting failed", e));
    await recordEvent({
      storeId: store.id,
      storeRef: store.subdomain,
      type: "payment.revoked",
      actor,
      data: { paymentId, note, kind: "renewal", hostingExpiresAt: rolledBack?.toISOString() ?? null },
    });
    const { text } = await renderTemplate("hosting.renewal_revoked", {
      store: store.name,
      expires: rolledBack ? formatDay(rolledBack) : "",
      reason_line: ` السبب: ${note}`,
      activate_url: (await paymentVars(store)).activate_url,
    });
    await deliverToMerchant(store.id, {
      key: `payment.revoked:${paymentId}`,
      text,
      purpose: "transactional",
      email: { subject: "بخصوص تجديد متجركم" },
    });
    return { ok: true, doomAt: null, hostingExpiresAt: rolledBack?.toISOString() ?? null };
  }

  const doomAt = new Date(now.getTime() + env.DOOM_HOURS * 36e5);
  if (store.status === "active") {
    const r = await transition({
      storeId: store.id,
      to: "frozen",
      from: ["active"],
      actor,
      set: { frozenAt: now, doomAt, hostingExpiresAt: null, plan: "launch", planMonths: null },
      reason: "payment_revoked",
      data: { paymentId },
    });
    if (!r.ok) {
      await db
        .update(platformPayments)
        .set({ status: "confirmed", reviewNote: null })
        .where(eq(platformPayments.id, paymentId));
      throw new Error("تعذّر إعادة المتجر للتجميد");
    }
  }
  await cancelJobs(store.id, HOSTING_JOBS).catch(() => {});
  await scheduleDoom(store.id, doomAt);

  await recordEvent({
    storeId: store.id,
    storeRef: store.subdomain,
    type: "payment.revoked",
    actor,
    data: { paymentId, note, doomAt: doomAt.toISOString() },
  });

  const hours = Math.max(1, Math.round((doomAt.getTime() - now.getTime()) / 36e5));
  const { text } = await renderTemplate("payment.rejected", {
    ...(await paymentVars(store)),
    hours,
    reason_line: ` السبب: ${note}`,
  });
  await deliverToMerchant(store.id, {
    key: `payment.revoked:${paymentId}`,
    text,
    purpose: "transactional",
    email: { subject: "بخصوص تفعيل متجركم" },
  });
  return { ok: true, doomAt: doomAt.toISOString() };
}
