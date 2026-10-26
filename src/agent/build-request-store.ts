import "server-only";
// build-request-store.ts — يحفظ «طلب البناء» القادم من محادثة الوكيل في store_requests (مصدره 'agent' ومحادثته مربوطة) بإجابات
// الأسئلة الخمسة منظمةً وملاحظات الوكيل الحرة. نفس المحادثة = نفس الطلب (لا تكرار حتى لو أُعيد الفعل). لا دفع ولا رابط هنا.
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { storeRequestEvents, storeRequests } from "@/db/schema/agency";
import { newRequestCode, secureToken, sha256 } from "@/lib/ids";
import { buildRequestData, type Area } from "./build-request";
import type { Lead } from "./lead";
import type { Offer } from "./offer";

const DAY_MS = 86_400_000;

export type CreatedRequest = { id: string; code: string; existed: boolean };

/** الطلب الحالي لهذه المحادثة (غير المسحوب ولا السبام) إن وُجد. */
async function existingFor(conversationId: string): Promise<{ id: string; code: string } | null> {
  const [row] = await db
    .select({ id: storeRequests.id, code: storeRequests.code })
    .from(storeRequests)
    .where(and(eq(storeRequests.conversationId, conversationId), inArray(storeRequests.status, ["submitted", "converted"])))
    .limit(1);
  return row ?? null;
}

export async function createBuildRequest(i: { conversationId: string; lead: Lead; declined: readonly Area[]; offer: Offer; summary: string }): Promise<CreatedRequest> {
  const found = await existingFor(i.conversationId);
  if (found) return { ...found, existed: true };

  const data = buildRequestData({ lead: i.lead, declined: i.declined, offer: i.offer, notes: i.summary });
  const draftTokenHash = await sha256(secureToken());
  const now = new Date();
  // تصادم نادر في الكود القصير: محاولات قليلة بكود جديد.
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = newRequestCode();
    try {
      const [row] = await db
        .insert(storeRequests)
        .values({
          code,
          status: "submitted",
          stage: "received",
          stageChangedAt: now,
          draftTokenHash,
          data: data as unknown as Record<string, unknown>,
          storeName: i.lead.storeName ?? null,
          email: i.lead.email ?? null,
          whatsapp: i.lead.whatsapp ?? null,
          source: "agent",
          conversationId: i.conversationId,
          submittedAt: now,
          expiresAt: new Date(now.getTime() + 365 * DAY_MS),
        })
        .returning({ id: storeRequests.id });
      if (!row) throw new Error("insert returned no row");
      await db.insert(storeRequestEvents).values({ requestId: row.id, type: "submitted", actor: "system", internalNote: `طلب بناء من محادثة الوكيل (${data.offer === "golden" ? "الدائرة الذهبية" : "السعر العادي"})` }).catch(() => {});
      return { id: row.id, code, existed: false };
    } catch (e) {
      // قد يكون تصادماً في الكود أو سباقاً على المحادثة نفسها: إن ظهر الطلب فهو لنا، وإلا نعيد بكود جديد.
      const again = await existingFor(i.conversationId);
      if (again) return { ...again, existed: true };
      if (attempt === 3) throw e;
    }
  }
  throw new Error("unreachable");
}
