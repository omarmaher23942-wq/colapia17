import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client"; import { conversations, stores } from "@/db/schema"; import { getPlatformSession } from "@/server/auth";
export async function GET() {
  if (!(await getPlatformSession())) return new Response("غير مصرح", { status: 401 });
  const rows = await db.select({ c: conversations, s: stores.subdomain }).from(conversations).leftJoin(stores, eq(stores.id, conversations.storeId)).orderBy(desc(conversations.createdAt)).limit(5000);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["name", "channel", "stage", "lead_score", "industry", "pain_points", "store", "created_at", "last_user_message_at", "lost_reason"];
  const body = rows.map(({ c, s }) => { const m = c.memory as any; return [c.profileName, c.channel, c.stage, c.leadScore, m?.industry, (m?.painPoints ?? []).join(" | "), s, c.createdAt.toISOString(), c.lastUserMessageAt?.toISOString(), c.lostReason].map(esc).join(","); });
  return new Response("\uFEFF" + [head.join(","), ...body].join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
