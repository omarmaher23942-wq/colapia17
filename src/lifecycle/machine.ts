import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { stores, lifecycleEvents } from "@/db/schema";
import { invalidateStoreCache } from "@/lib/tenant";
import { cancelJobs, JOB_KINDS, type JobKind } from "./scheduler";

type Store = typeof stores.$inferSelect;
export type StoreStatus = Store["status"];

/**
 * جدول الانتقالات المسموحة (المصدر الوحيد). أي تغيير حالة خارج transition() ممنوع.
 *   pending_review -> building : إرسال الأونر أو انتهاء مؤقت الـ 12 ساعة (ينجح واحد فقط)
 *   trial (+doomAt)            : رفض الدفع لا يغيّر الحالة، يضبط doomAt فقط
 *   deleted -> frozen          : استرجاع الأونر خلال نافذة الحذف الناعم
 */
export const TRANSITIONS: Record<StoreStatus, readonly StoreStatus[]> = {
  intake: ["pending_review", "building", "deleted"],
  pending_review: ["building", "deleted"],
  building: ["review", "trial", "deleted"],
  review: ["trial", "building", "deleted"],
  trial: ["frozen", "active", "suspended", "deleted"],
  frozen: ["active", "trial", "deleted"],
  // active → frozen: إلغاء تفعيل قُبل آلياً ثم تبيّن عند المراجعة أنه غير صحيح.
  active: ["suspended", "deleted", "frozen"],
  suspended: ["active", "deleted"],
  deleted: ["frozen"],
};

const FROM_FOR = (() => {
  const m = {} as Record<StoreStatus, StoreStatus[]>;
  for (const to of Object.keys(TRANSITIONS) as StoreStatus[]) m[to] = [];
  for (const [from, tos] of Object.entries(TRANSITIONS) as [StoreStatus, readonly StoreStatus[]][]) {
    for (const to of tos) m[to].push(from);
  }
  return m;
})();

export const canTransition = (from: StoreStatus, to: StoreStatus) => TRANSITIONS[from]?.includes(to) ?? false;

const TRIAL_KINDS: JobKind[] = ["trial.reminder_6h", "trial.reminder_20h", "trial.freeze", "trial.last_chance", "trial.purge"];
const DOOM_KINDS: JobKind[] = ["doom.reminder_12h", "doom.reminder_1h", "doom.purge"];
const HOSTING_KINDS: JobKind[] = ["hosting.reminder_30d", "hosting.reminder_7d", "hosting.reminder_1d", "hosting.expired", "hosting.paused"];

/** مؤقتات تُلغى تلقائياً بمجرد دخول الحالة */
const CANCEL_ON_ENTER: Partial<Record<StoreStatus, readonly JobKind[]>> = {
  building: ["review.auto_release", "review.reminder"],
  active: [...TRIAL_KINDS, ...DOOM_KINDS, "payment.invite"],
  // إلغاء تفعيل (active → frozen): لا تذكيرات تجديد لمتجر غير مدفوع.
  frozen: HOSTING_KINDS,
  deleted: JOB_KINDS,
};

export type EventInput = {
  storeId?: string | null;
  storeRef?: string | null;
  conversationId?: string | null;
  type: string;
  from?: string | null;
  to?: string | null;
  actor?: string;
  data?: Record<string, unknown>;
};

/** سجل التدقيق لا يكسر المسار الأساسي إن فشل، لكنه يُطبع في اللوج */
export async function recordEvent(e: EventInput) {
  try {
    await db.insert(lifecycleEvents).values({
      storeId: e.storeId ?? null,
      storeRef: e.storeRef ?? null,
      conversationId: e.conversationId ?? null,
      type: e.type,
      fromStatus: e.from ?? null,
      toStatus: e.to ?? null,
      actor: e.actor ?? "system",
      data: e.data ?? {},
    });
  } catch (err) {
    console.error("[lifecycle] event insert failed", e.type, err);
  }
}

export type TransitionInput = {
  storeId: string;
  to: StoreStatus;
  /** system | timer | owner:<id> | merchant:<id> */
  actor: string;
  /** قيد أضيق من الجدول (مثلاً ["pending_review"] فقط) */
  from?: readonly StoreStatus[];
  /** حقول تُكتب في نفس الـ UPDATE الذري */
  set?: Partial<typeof stores.$inferInsert>;
  reason?: string;
  data?: Record<string, unknown>;
};

export type TransitionResult =
  | { ok: true; store: Store; from: StoreStatus }
  | { ok: false; reason: "not_found" | "not_allowed" | "stale"; current?: StoreStatus };

/**
 * الانتقال الذري الوحيد. النمط: UPDATE ... WHERE status IN (المسموح) RETURNING.
 * إذا ضغط الأونر "إرسال" في اللحظة نفسها التي انتهى فيها المؤقت، ينجح واحد فقط ويرجع الآخر ok:false.
 * ملاحظة: الآثار الجانبية (إرسال رسائل، بدء بناء) يجب أن تُنفَّذ فقط عند ok:true.
 * حقل from في السجل مقروء قبل التحديث، وقد يختلف في سباق نادر جداً (للتدقيق فقط، لا للتحكم).
 */
export async function transition(input: TransitionInput): Promise<TransitionResult> {
  const [cur] = await db.select({ status: stores.status }).from(stores).where(eq(stores.id, input.storeId)).limit(1);
  if (!cur) return { ok: false, reason: "not_found" };

  const allowed = (input.from ?? FROM_FOR[input.to]).filter((s) => canTransition(s, input.to));
  if (!allowed.includes(cur.status)) return { ok: false, reason: "not_allowed", current: cur.status };

  const [row] = await db
    .update(stores)
    .set({ ...input.set, status: input.to, updatedAt: new Date() })
    .where(and(eq(stores.id, input.storeId), inArray(stores.status, allowed)))
    .returning();
  if (!row) return { ok: false, reason: "stale" };

  await Promise.all([
    recordEvent({
      storeId: row.id,
      storeRef: row.subdomain,
      type: "store.transition",
      from: cur.status,
      to: input.to,
      actor: input.actor,
      data: { ...(input.reason ? { reason: input.reason } : {}), ...(input.data ?? {}) },
    }),
    invalidateStoreCache(row).catch(() => {}),
    cancelJobs(row.id, CANCEL_ON_ENTER[input.to] ?? []).catch((e) => console.error("[lifecycle] cancelJobs failed", e)),
  ]);

  return { ok: true, store: row, from: cur.status };
}