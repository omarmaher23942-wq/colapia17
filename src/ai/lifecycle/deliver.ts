import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, stores } from "@/db/schema";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { transition } from "@/lifecycle/machine";
import { cancelJobs } from "@/lifecycle/scheduler";
import type { LifecycleTimings } from "@/lifecycle/timings";
import { currentPricing } from "@/server/pricing";
import { beginPreviewClock } from "@/server/preview-clock";

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

/**
 * تسليم الفريق للمتجر المبني (V5): ينتقل إلى `setup` (بانتظار رابط الإعداد، مخفي عن الزوار). **لا عدّاد هنا ولا رسالة آلية**:
 * المعاينة المجانية تبدأ عند أول فتح لرابط الإعداد (server/preview-clock.ts)، والرسالة الجاهزة يرسلها الفريق بنفسه من لوحة المحادثة.
 */
export async function deliverStore(
  storeId: string,
  by: string,
  opts: { timings?: LifecycleTimings } = {}
): Promise<boolean> {
  const [s] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!s || (s.status !== "review" && s.status !== "building")) return false;

  const now = new Date();
  void opts;
  // السعر يُثبَّت لحظة التسليم (سلّم الأسعار): هذا ما يدفعه العميل لاحقاً.
  const price = (await currentPricing()).build.price;

  const r = await transition({
    storeId,
    to: "setup",
    from: ["review", "building"],
    actor: by === "auto" ? "timer" : by,
    set: { deliveredAt: now, priceLockedEgp: s.priceLockedEgp ?? price },
    reason: "delivered_for_setup",
  });
  if (!r.ok) return false;

  await safe("cancel_auto", storeId, () => cancelJobs(storeId, ["delivery.auto"]));
  await safe("stage", storeId, () => db.update(conversations).set({ stage: "delivered", updatedAt: now }).where(eq(conversations.storeId, storeId)));
  await notifyAdmin(`متجر ${s.subdomain} جاهز لإرسال رابط الإعداد للتاجر (${by})`, { storeId }).catch(() => {});
  return true;
}

/**
 * إكمال التاجر «إعداد المتجر»: المتجر من `setup` إلى `trial` (يظهر للزوار). العدّاد بدأ عند أول فتح لرابط الإعداد، فلا يُعاد
 * ضبطه هنا؛ وإن لم يكن قد بدأ (متجر قديم دخل بغير الرابط) يبدأ الآن. تفعيل مكرر لا يبدأ تجربتين.
 */
export async function startTrial(
  storeId: string,
  by: string,
  opts: { timings?: LifecycleTimings } = {}
): Promise<{ ok: true; trialEndsAt: Date } | { ok: false; reason: "not_found" | "not_allowed" | "stale" }> {
  const [s] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!s) return { ok: false, reason: "not_found" };
  if (s.status !== "setup") return { ok: false, reason: "not_allowed" };

  const clock = await beginPreviewClock(storeId, opts);
  if (!clock.endsAt) return { ok: false, reason: "stale" };

  const now = new Date();
  const r = await transition({
    storeId,
    to: "trial",
    from: ["setup"],
    actor: by,
    set: { setupCompletedAt: now, deliveredAt: s.deliveredAt ?? now },
    reason: "setup_completed",
  });
  if (!r.ok) return { ok: false, reason: r.reason };

  await safe("stage", storeId, () => db.update(conversations).set({ stage: "delivered", updatedAt: now }).where(eq(conversations.storeId, storeId)));
  await notifyAdmin(`أكمل التاجر إعداد متجر ${s.subdomain} وهو الآن ظاهر في فترة المعاينة`, { storeId }).catch(() => {});
  return { ok: true, trialEndsAt: clock.endsAt };
}
