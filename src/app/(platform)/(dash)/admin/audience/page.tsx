// /admin/audience — كل من سجّل في Colapia، مصنّفاً حسب أين وصل، ومراسلتهم فرداً أو شريحة أو قائمة مختارة.
import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { outreachCampaigns } from "@/db/schema";
import { loadAudience, SEGMENTS } from "@/server/outreach";
import { AudienceCenter } from "@/components/platform/AudienceCenter";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الجمهور والبريد" };

export default async function AudiencePage() {
  const [people, campaigns] = await Promise.all([
    loadAudience(),
    db.select().from(outreachCampaigns).orderBy(desc(outreachCampaigns.createdAt)).limit(30),
  ]);
  return (
    <AudienceCenter
      people={people}
      segments={SEGMENTS}
      campaigns={campaigns.map((c) => ({
        id: c.id,
        subject: c.subject,
        segment: c.segment,
        recipients: c.recipients,
        sent: c.sent,
        failed: c.failed,
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
