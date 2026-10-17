import "server-only";
// timings.ts — مدد ما بعد التسليم (قرار المالك: قابلة للضبط من /admin/flags ← «lifecycle»):
// تجربة trialHours (افتراضي 24) ← إيقاف + بريد ← بعد noticeHours (24) «تنبيه أخير قبل الحذف» ← بعد deleteHours (24)
// حذف نهائي. ومهلة السماح بعد انتهاء الاشتراك المدفوع graceDays (3) ثم إيقاف بلا حذف.
// مثال config: { "trialHours": 24, "noticeHours": 24, "deleteHours": 24, "graceDays": 3 }
import { getFlag } from "@/lib/flags";
import { env } from "@/lib/env";
import { timingsFrom, type LifecycleTimings } from "./timings-rules";

export const LIFECYCLE_FLAG = "lifecycle";
export type { LifecycleTimings };

export async function lifecycleTimings(): Promise<LifecycleTimings> {
  const f = await getFlag<Record<string, unknown>>(LIFECYCLE_FLAG).catch(() => ({ enabled: true, config: null }));
  return timingsFrom(f.config, env.TRIAL_HOURS);
}

export { hostingGraceDays } from "@/server/hosting-grace";
