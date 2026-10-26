import "server-only";
// client-projects.ts — مشاريع العميل في بوابة /dashboard (حساب بلا متجر مستضاف): حالتها وتاريخ تسليمها والمستودع ورابط
// المتجر، وهل التعديل الحالي مجاني أم برسوم. كل استعلام مقيَّد بمعرّف العميل من الجلسة.
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { storeRequests } from "@/db/schema";
import { clientStatus, type ClientStatus } from "@/agency/status";
import { editTerms, type EditTermsResult, type PricingModel } from "@/lib/platform-pricing";
import { currentPricing } from "@/server/pricing";
import { freeEditUsed } from "./edit-requests";

export type ClientProject = {
  id: string;
  code: string;
  storeName: string;
  offer: "golden" | "standard" | null;
  status: ClientStatus;
  confirmedAt: Date | null;
  deliveredAt: Date | null;
  freeEditUntil: Date | null;
  repoUrl: string | null;
  storeUrl: string | null;
  edit: EditTermsResult;
};

export async function clientProjects(merchantId: string, model?: PricingModel): Promise<ClientProject[]> {
  const pricing = model ?? (await currentPricing());
  const rows = await db
    .select()
    .from(storeRequests)
    .where(and(eq(storeRequests.merchantId, merchantId), inArray(storeRequests.status, ["submitted", "awaiting_payment"])))
    .orderBy(desc(storeRequests.createdAt))
    .limit(20);
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      code: r.code,
      storeName: r.storeName ?? "",
      offer: r.offer,
      status: clientStatus(r),
      confirmedAt: r.confirmedAt,
      deliveredAt: r.deliveredAt,
      freeEditUntil: r.freeEditUntil,
      repoUrl: r.repoUrl,
      storeUrl: r.storeUrl,
      edit: editTerms(pricing, { deliveredAt: r.deliveredAt, freeEditUntil: r.freeEditUntil, freeUsed: r.deliveredAt ? await freeEditUsed(r.id) : false }),
    }))
  );
}

/** مشروع واحد للعميل نفسه فقط (null إن لم يكن له). */
export async function clientProject(merchantId: string, requestId: string): Promise<ClientProject | null> {
  return (await clientProjects(merchantId)).find((p) => p.id === requestId) ?? null;
}
