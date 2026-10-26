import "server-only";
// settings.ts — إعداد خط الإنتاج من لوحة المالك (/admin/flags ← «production»): مهلة كل حالة بالساعات.
// مثال config: { "sla": { "new": 24, "assigned": 24, "building": 72, "review": 12, "ready": 12 } }
import { getFlag } from "@/lib/flags";
import { slaFrom, type DEFAULT_SLA_HOURS } from "./production";

export const PRODUCTION_FLAG = "production";

export async function productionSla(): Promise<typeof DEFAULT_SLA_HOURS> {
  const f = await getFlag<Record<string, unknown>>(PRODUCTION_FLAG).catch(() => ({ enabled: true, config: null }));
  return slaFrom(f.config);
}
