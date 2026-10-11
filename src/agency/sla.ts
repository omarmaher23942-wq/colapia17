import "server-only";
// sla.ts — تنبيه الفريق بالطلبات المتأخرة داخلياً (تجاوزت مهلة حالتها) أو المتأخرة عن وعد العميل. مرة واحدة لكل
// حالة (sla_alerted_at يُمسح عند كل انتقال). يُستدعى من ops/tick.
import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { storeRequests } from "@/db/schema/agency";
import { overdueHours, PRODUCTION_INFO, type ProductionState } from "./production";
import { productionSla } from "./settings";
import { emailMembers, managerIds } from "./notify";

export async function alertOverdueRequests(now = new Date()): Promise<number> {
  const sla = await productionSla();
  const rows = await db
    .select()
    .from(storeRequests)
    .where(and(eq(storeRequests.status, "submitted"), ne(storeRequests.production, "delivered"), isNull(storeRequests.slaAlertedAt), isNull(storeRequests.waitingReason)));
  const managers = await managerIds();
  let alerted = 0;
  for (const r of rows) {
    const state = r.production as ProductionState;
    const over = overdueHours(state, r.productionChangedAt, sla, now);
    const promiseLate = Boolean(r.etaTo && r.etaTo < now);
    if (over <= 0 && !promiseLate) continue;
    // المسؤول المباشر عن الحالة + المديرون.
    const owner = state === "review" ? r.reviewerId : state === "new" ? null : r.builderId;
    const lines = [
      `متجر «${r.storeName ?? r.code}» (${r.code}) في حالة «${PRODUCTION_INFO[state].label}»${over > 0 ? ` متجاوزاً مهلتها بـ ${over} ساعة` : ""}.`,
      promiseLate ? "وتجاوزنا موعد التسليم الذي رآه العميل: تواصلوا معه بصدق عن الموعد الجديد." : "",
    ].filter(Boolean);
    await emailMembers([owner, ...managers], { subject: `تأخر: ${r.code}`, headline: "طلب متأخر", lines, requestId: r.id });
    await db.update(storeRequests).set({ slaAlertedAt: now }).where(eq(storeRequests.id, r.id));
    alerted++;
  }
  return alerted;
}
