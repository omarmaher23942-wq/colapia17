// /dashboard/own — «نسخة من كود متجرك»: طلب يرسله صاحب المتجر المدفوع، ويجهّز الفريق المشروع ويسلّمه بدليل تشغيله.
// (حل محل «امتلك متجرك» الذاتي عبر GitHub/Vercel/Neon: قرار مُراجَع في PLAN.md القسم 12.)
import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { storeActivity } from "@/db/schema";
import { requireStoreArea } from "@/server/merchant-guard";
import { CodeHandoff } from "@/components/dashboard/own/CodeHandoff";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "نسخة من كود متجرك" };

export default async function OwnPage() {
  const s = await requireStoreArea("billing");
  const [last] = await db
    .select({ at: storeActivity.createdAt })
    .from(storeActivity)
    .where(and(eq(storeActivity.storeId, s.storeId), eq(storeActivity.action, "code.requested")))
    .orderBy(desc(storeActivity.createdAt))
    .limit(1)
    .catch(() => []);
  return <CodeHandoff active={s.store.status === "active"} requestedAt={last?.at.toISOString() ?? null} ownedUrl={s.store.ownedUrl} />;
}
