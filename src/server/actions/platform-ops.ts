"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, stores, systemEvents } from "@/db/schema";
import { requirePlatformCap } from "@/server/platform-guard";
import { deliverStore } from "@/ai/lifecycle/deliver";
import { cancelJobs, schedule } from "@/lifecycle/scheduler";
import { transition } from "@/lifecycle/machine";
import { lifecycleTimings } from "@/lifecycle/timings";
import { invalidateStoreCache } from "@/lib/tenant";

async function adminOrOwner() {
  return requirePlatformCap("stores.manage", "غير مصرح: هذا الإجراء يتطلب صلاحيات مسؤول المنصة");
}

export async function deliverNowAction(storeId: string) {
  const u = await adminOrOwner();
  const ok = await deliverStore(storeId, `owner:${u.id}`);
  if (!ok) throw new Error("لا يمكن التسليم في الحالة الحالية للمتجر");
}

export async function extendAction(storeId: string, what: "trial" | "grace", hours: number) {
  await adminOrOwner();
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 30) {
    throw new Error("مدة التمديد غير صالحة");
  }
  const [s] = await db.select().from(stores).where(eq(stores.id, storeId));
  if (!s) return;
  const t = await lifecycleTimings();
  const noticeMs = t.noticeHours * 36e5;
  const deleteMs = t.deleteHours * 36e5;

  if (what === "trial") {
    if (s.status !== "trial") throw new Error("المتجر ليس في فترة التجربة");
    if (s.doomAt) throw new Error("المتجر تحت مهلة الحذف، ألغِ المهلة أولاً");
    const at = new Date((s.trialEndsAt ?? new Date()).getTime() + hours * 36e5);
    const purgeAt = new Date(at.getTime() + noticeMs + deleteMs);
    await cancelJobs(storeId, ["trial.reminder_20h", "trial.freeze", "trial.last_chance", "trial.purge"]);
    // trialEndsAt هو المصدر الوحيد، وdemoExpiresAt يُكتب معه للتوافق مع القراءات القديمة.
    await db
      .update(stores)
      .set({ trialEndsAt: at, demoExpiresAt: at, purgeAt, updatedAt: new Date() })
      .where(eq(stores.id, storeId));
    const remind = new Date(at.getTime() - 2 * 36e5);
    if (remind.getTime() > Date.now()) await schedule(storeId, "trial.reminder_20h", remind);
    await schedule(storeId, "trial.freeze", at);
    await schedule(storeId, "trial.last_chance", new Date(at.getTime() + noticeMs));
    await schedule(storeId, "trial.purge", purgeAt);
  }

  if (what === "grace") {
    if (s.status !== "frozen") throw new Error("المتجر ليس مجمّداً");
    const at = new Date(Math.max(s.purgeAt?.getTime() ?? 0, Date.now()) + hours * 36e5);
    await cancelJobs(storeId, ["trial.last_chance", "trial.purge"]);
    await db.update(stores).set({ purgeAt: at, updatedAt: new Date() }).where(eq(stores.id, storeId));
    const lastChance = new Date(at.getTime() - deleteMs);
    if (lastChance.getTime() > Date.now()) await schedule(storeId, "trial.last_chance", lastChance);
    await schedule(storeId, "trial.purge", at);
  }

  await invalidateStoreCache(s).catch(() => {});
  await db.insert(systemEvents).values({
    scope: "store",
    storeId,
    actor: "platform",
    message: `تمديد ${what} بـ ${hours} ساعة`,
  });
  revalidatePath(`/admin/stores/${storeId}`);
}

export async function freezeNowAction(storeId: string) {
  const u = await adminOrOwner();
  const now = new Date();
  const t = await lifecycleTimings();
  const purgeAt = new Date(now.getTime() + (t.noticeHours + t.deleteHours) * 36e5);
  const r = await transition({
    storeId,
    to: "frozen",
    from: ["trial"],
    actor: `owner:${u.id}`,
    set: { frozenAt: now, purgeAt },
    reason: "manual_freeze",
  });
  if (!r.ok) throw new Error(`تعذر التجميد: ${r.reason}`);
  await cancelJobs(storeId, ["trial.reminder_6h", "trial.reminder_20h", "trial.freeze"]);
  // موعد الحذف المعلن يطابق المهام المجدولة فعلاً.
  await schedule(storeId, "trial.last_chance", new Date(now.getTime() + t.noticeHours * 36e5));
  await schedule(storeId, "trial.purge", purgeAt);
  await db
    .update(conversations)
    .set({ stage: "frozen", updatedAt: now })
    .where(eq(conversations.storeId, storeId));
  revalidatePath(`/admin/stores/${storeId}`);
}

