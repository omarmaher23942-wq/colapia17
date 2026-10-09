import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, platformPayments, stores } from "@/db/schema";
import { env } from "@/lib/env";
import { storeUrl } from "@/lib/utils";
import { invalidateStoreCache } from "@/lib/tenant";
import {
  cancelJobs,
  scheduleDoom,
  scheduleOwnership,
  type JobKind,
} from "./scheduler";
import { ownDeadline, ownPurgeAt } from "@/lib/ownership-window";
import { recordEvent, transition } from "./machine";
import { deliverToMerchant } from "./messenger";
import { paymentVars, renderTemplate } from "./templates";
import { emitPaymentConfirmed } from "@/server/realtime/emitters";

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
  if (!pay) throw new Error("الدفعة اتراجعت قبل كده أو غير موجودة");

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

  if (cur !== "active") {
    const r = await transition({
      storeId: store.id,
      to: "active",
      from: ["trial", "frozen"],
      actor,
      set: {
        activatedAt: store.activatedAt ?? now,
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
  }

  // مهلة نقل المتجر لحسابات التاجر تبدأ من التفعيل (تذكير، ثم إيقاف الطلبات، ثم الحذف إن لم يُنقل).
  const activatedAt = store.activatedAt ?? now;
  await scheduleOwnership(store.id, ownDeadline(activatedAt), ownPurgeAt(activatedAt)).catch((e) =>
    console.error("[payments] schedule ownership jobs failed", e)
  );

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
    data: { paymentId },
  });

  // حدث Pusher: تأكيد الدفعة.
  void emitPaymentConfirmed(store.id, {
    paymentId,
    storeId: store.id,
    amountPiasters: pay.amountPiasters,
    confirmedAt: now.toISOString(),
    confirmedBy: actor,
  });

  const { text } = await renderTemplate("payment.confirmed", {
    store: store.name,
    store_url: storeUrl(store.subdomain),
  });
  await deliverToMerchant(store.id, {
    key: `payment.confirmed:${paymentId}`,
    text,
    purpose: "transactional",
    email: { subject: "تم تأكيد دفعك" },
  });
  return { ok: true };
}

export async function rejectStorePayment(
  paymentId: string,
  reviewerId: string,
  note?: string
): Promise<{ ok: true; doomAt: string }> {
  const [pay] = await db
    .select()
    .from(platformPayments)
    .where(eq(platformPayments.id, paymentId))
    .limit(1);
  if (!pay || pay.status !== "under_review")
    throw new Error("الدفعة اتراجعت قبل كده أو غير موجودة");

  const [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.id, pay.storeId))
    .limit(1);
  if (!store) throw new Error("المتجر غير موجود");
  if (store.status !== "trial" && store.status !== "frozen")
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
  if (!claimed) throw new Error("الدفعة اتراجعت قبل كده");

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
    ...paymentVars(store.name),
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
 * إلغاء تفعيل قُبل فورياً ثم تبيّن عند المراجعة أن التحويل لم يصل. يعيد المتجر للتجميد بمهلة،
 * ويُبلغ التاجر بالسبب. لا يُلغى تفعيل متجر انتقل إلى حساباته الخاصة (بياناته لم تعد عندنا).
 */
export async function revokeStorePayment(
  paymentId: string,
  reviewerId: string,
  note: string
): Promise<{ ok: true; doomAt: string }> {
  const [pay] = await db.select().from(platformPayments).where(eq(platformPayments.id, paymentId)).limit(1);
  if (!pay || pay.status !== "confirmed") throw new Error("الدفعة ليست مؤكدة");
  const [store] = await db.select().from(stores).where(eq(stores.id, pay.storeId)).limit(1);
  if (!store) throw new Error("المتجر غير موجود");
  if (store.ownedAt) throw new Error("التاجر استلم متجره على حساباته، لا يمكن إلغاء تفعيله من هنا");

  const now = new Date();
  const [claimed] = await db
    .update(platformPayments)
    .set({ status: "rejected", reviewedBy: reviewerId, reviewedAt: now, reviewNote: note })
    .where(and(eq(platformPayments.id, paymentId), eq(platformPayments.status, "confirmed")))
    .returning({ id: platformPayments.id });
  if (!claimed) throw new Error("الدفعة تغيّرت قبل قليل");

  const doomAt = new Date(now.getTime() + env.DOOM_HOURS * 36e5);
  const actor = `owner:${reviewerId}`;
  if (store.status === "active") {
    const r = await transition({
      storeId: store.id,
      to: "frozen",
      from: ["active"],
      actor,
      set: { frozenAt: now, doomAt },
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
    ...paymentVars(store.name),
    hours,
    reason_line: ` السبب: ${note}`,
  });
  await deliverToMerchant(store.id, {
    key: `payment.revoked:${paymentId}`,
    text,
    purpose: "transactional",
    email: { subject: "بخصوص تفعيل متجرك" },
  });
  return { ok: true, doomAt: doomAt.toISOString() };
}
