import { desc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";
import { platformUser } from "@/server/platform-guard";
import { LEAD_STATUS_LABEL, leadRecordOf } from "@/agent/lead-capture";
import { csvResponse, toCsv } from "@/server/csv";

export async function GET() {
  if (!(await platformUser({ cap: "leads" }))) return new Response("غير مصرح", { status: 401 });
  const rows = await db.select({ m: conversations.memory }).from(conversations).where(sql`${conversations.memory} ? 'v6Lead'`).orderBy(desc(conversations.updatedAt)).limit(5000);
  const body = rows.flatMap(({ m }) => {
    const r = leadRecordOf(m);
    return r ? [[r.name, r.whatsapp, r.email ?? "", r.igUsername ?? "", r.service, LEAD_STATUS_LABEL[r.status], r.note ?? "", r.at]] : [];
  });
  return csvResponse("leads", toCsv(["name", "whatsapp", "email", "instagram", "service", "status", "note", "created_at"], body));
}
