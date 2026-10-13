// dashboard/requests — «اطلب تعديل»: طلبات التعديل للوكالة وحصة الشهر وردود الفريق.
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getMerchantSession } from "@/server/auth";
import { requireStoreArea } from "@/server/merchant-guard";
import { db } from "@/db/client";
import { storeChangeRequests } from "@/db/schema";
import { NO_STORE_HREF } from "@/lib/edition";
import { quotaFor } from "@/server/change-quota";
import { ChangeRequests } from "@/components/dashboard/requests/ChangeRequests";
import { CHANGE_AREAS, type ChangeArea } from "@/lib/change-requests";

export const dynamic = "force-dynamic";
export const metadata = { title: "طلب تعديل" };

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/requests");
  if (!session.storeId || !session.store) redirect(NO_STORE_HREF);
  await requireStoreArea("requests");
  const [rows, quota, sp] = await Promise.all([
    db.select().from(storeChangeRequests).where(eq(storeChangeRequests.storeId, session.storeId)).orderBy(desc(storeChangeRequests.createdAt)).limit(50),
    quotaFor(session.storeId),
    searchParams,
  ]);
  const area = (CHANGE_AREAS as readonly string[]).includes(sp.area ?? "") ? (sp.area as ChangeArea) : "design";
  return (
    <div className="mx-auto max-w-3xl">
      <ChangeRequests
        allowed={["trial", "active"].includes(session.store.status)}
        quota={quota}
        initialArea={area}
        rows={rows.map((r) => ({ id: r.id, area: r.area as ChangeArea, body: r.body, status: r.status as "open", teamNote: r.teamNote, at: r.createdAt.toISOString(), doneAt: r.doneAt?.toISOString() ?? null }))}
      />
    </div>
  );
}
