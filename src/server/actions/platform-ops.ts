"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, stores, systemEvents } from "@/db/schema";
import { getPlatformSession } from "@/server/auth";
import { deliverStore } from "@/ai/lifecycle/deliver";
import {
  cancelJobs,
  schedule,
  scheduleDelivery,
  scheduleReview,
} from "@/lifecycle/scheduler";
import { transition } from "@/lifecycle/machine";
import { releaseToBuild } from "@/lifecycle/release";
import { env } from "@/lib/env";

async function adminOrOwner() {
  const u = await getPlatformSession();
  if (!u || u.role === "reviewer") {
    throw new Error("غير مصرح: هذا الإجراء يتطلب صلاحيات مسؤول المنصة");
  }
  return u;
}

export async function deliverNowAction(storeId: string) {
  const u = await adminOrOwner();
  const ok = await deliverStore(storeId, `owner:${u.id}`);
  if (!ok) throw new Error("لا يمكن التسليم في الحالة الحالية للمتجر");
  revalidatePath("/admin/pipeline");
}

export async function extendAction(
  storeId: string,
  what: "review" | "deliver" | "trial" | "grace",
  hours: number
) {
  await adminOrOwner();
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 30) {
    throw new Error("مدة التمديد غير صالحة");
  }
  const [s] = await db.select().from(stores).where(eq(stores.id, storeId));
  if (!s) return;

  if (what === "review") {
    if (s.status !== "pending_review") throw new Error("المتجر ليس في مرحلة المراجعة");
    const at = new Date(
      Math.max(s.reviewDeadlineAt?.getTime() ?? 0, Date.now()) + hours * 36e5
    );
    await db
      .update(stores)
      .set({ reviewDeadlineAt: at, updatedAt: new Date() })
      .where(eq(stores.id, storeId));
    await scheduleReview(storeId, at);
  }

  if (what === "deliver") {
    if (s.status !== "review") throw new Error("المتجر ليس في مرحلة التسليم");
    const at = new Date(
      Math.max(s.deliverAt?.getTime() ?? 0, Date.now()) + hours * 36e5
    );
    await cancelJobs(storeId, ["delivery.auto"]);
    await db
      .update(stores)
      .set({ deliverAt: at, updatedAt: new Date() })
      .where(eq(stores.id, storeId));
    await scheduleDelivery(storeId, at);
  }

  if (what === "trial") {
    if (s.status !== "trial") throw new Error("المتجر ليس في فترة التجربة");
    if (s.doomAt) throw new Error("المتجر تحت مهلة الحذف، ألغِ المهلة أولاً");
    const at = new Date((s.trialEndsAt ?? new Date()).getTime() + hours * 36e5);
    await cancelJobs(storeId, [
      "trial.reminder_20h",
      "trial.freeze",
      "trial.last_chance",
      "trial.purge",
    ]);
    await db
      .update(stores)
      .set({ trialEndsAt: at, updatedAt: new Date() })
      .where(eq(stores.id, storeId));
    const remind = new Date(at.getTime() - 4 * 36e5);
    if (remind.getTime() > Date.now()) {
      await schedule(storeId, "trial.reminder_20h", remind);
    }
    await schedule(storeId, "trial.freeze", at);
    await schedule(storeId, "trial.last_chance", new Date(at.getTime() + 3 * 864e5));
    await schedule(storeId, "trial.purge", new Date(at.getTime() + env.GRACE_DAYS * 864e5));
  }

  if (what === "grace") {
    if (s.status !== "frozen") throw new Error("المتجر ليس مجمّداً");
    const at = new Date(
      Math.max(s.purgeAt?.getTime() ?? 0, Date.now()) + hours * 36e5
    );
    await cancelJobs(storeId, ["trial.purge"]);
    await db
      .update(stores)
      .set({ purgeAt: at, updatedAt: new Date() })
      .where(eq(stores.id, storeId));
    await schedule(storeId, "trial.purge", at);
  }

  await db.insert(systemEvents).values({
    scope: "store",
    storeId,
    actor: "platform",
    message: `تمديد ${what} بـ ${hours} ساعة`,
  });
  revalidatePath("/admin/pipeline");
}

export async function freezeNowAction(storeId: string) {
  const u = await adminOrOwner();
  const now = new Date();
  const r = await transition({
    storeId,
    to: "frozen",
    from: ["trial"],
    actor: `owner:${u.id}`,
    set: { frozenAt: now, purgeAt: new Date(now.getTime() + env.GRACE_DAYS * 864e5) },
    reason: "manual_freeze",
  });
  if (!r.ok) throw new Error(`تعذر التجميد: ${r.reason}`);
  await cancelJobs(storeId, ["trial.reminder_6h", "trial.reminder_20h", "trial.freeze"]);
  await db
    .update(conversations)
    .set({ stage: "frozen", updatedAt: now })
    .where(eq(conversations.storeId, storeId));
  revalidatePath("/admin/pipeline");
}

/**
 * إعادة بناء المتجر من لوحة الأونر.
 *
 * التعديل الجذري: نستخدم releaseToBuild مع معالجة شاملة للأخطاء، بحيث لا
 * يُرجَع 500 error لصفحة إدارة المتجر. كل مسار فشل له رسالة عربية مفهومة.
 */
export async function retryBuildAction(storeId: string): Promise<{
  ok: boolean;
  jobId?: string;
  error?: string;
}> {
  const u = await adminOrOwner();
  try {
    const result = await releaseToBuild(storeId, `owner:${u.id}`);
    if (result.started) {
      revalidatePath("/admin/pipeline");
      revalidatePath(`/admin/stores/${storeId}`);
      return { ok: true, jobId: result.jobId };
    }

    const messages: Record<typeof result.reason, string> = {
      not_found: "المتجر غير موجود",
      not_allowed: `حالة المتجر الحالية (${result.current}) لا تسمح بإعادة البناء`,
      stale: "البحث توقف — حاول مرة أخرى",
      already_running:
        "البناء جارٍ بالفعل — انتظر انتهاءه أو حاول بعد 10 دقائق",
      no_data: "لا توجد بيانات كافية للبناء (intake مفقود)",
      start_failed: "فشل بدء البناء — حاول بعد دقيقة",
    };
    return { ok: false, error: messages[result.reason] };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "خطأ غير متوقع",
    };
  }
}