// GET /admin/conversations/export — CSV للقائمة المصفّاة (?filter=&stage=&q=) أو نص محادثة واحدة (?id=). صلاحية المحادثات.
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, messages, stores } from "@/db/schema";
import { requirePlatformPage } from "@/server/platform-guard";
import { csvResponse, toCsv } from "@/server/csv";
import { isConvFilter, likeEscape, matchesFilter, type ConvFilter } from "@/agency/conv-filters";
import { formatDateTime } from "@/lib/locale";
import type { Lead } from "@/agent/lead";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(req: Request) {
  const me = await requirePlatformPage({ cap: "conversations" });
  const u = new URL(req.url);
  const id = u.searchParams.get("id");
  if (id) {
    if (!UUID.test(id)) return new Response("Not found", { status: 404 });
    const [c] = await db.select({ name: conversations.profileName }).from(conversations).where(eq(conversations.id, id)).limit(1);
    if (!c) return new Response("Not found", { status: 404 });
    const rows = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt).limit(2000);
    const who: Record<string, string> = { user: c.name ?? "العميل", assistant: "المساعد", human_agent: "الفريق" };
    const body = rows.map((m) => `[${formatDateTime(m.createdAt)}] ${who[m.role] ?? m.role}: ${m.text ?? "[مرفق]"}`).join("\n");
    return new Response("﻿" + body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="conversation-${id.slice(0, 8)}.txt"`, "Cache-Control": "no-store" } });
  }
  const rawFilter = u.searchParams.get("filter");
  const filter: ConvFilter = isConvFilter(rawFilter) ? rawFilter : "all";
  const stage = u.searchParams.get("stage") ?? "";
  const needle = (u.searchParams.get("q") ?? "").trim().slice(0, 80);
  const like = `%${likeEscape(needle)}%`;
  const search = needle ? sql`(${conversations.profileName} ilike ${like} or ${conversations.memory}::text ilike ${like} or ${stores.name} ilike ${like})` : undefined;
  const list = await db
    .select({ c: conversations, storeName: stores.name })
    .from(conversations)
    .leftJoin(stores, eq(stores.id, conversations.storeId))
    .where(and(stage && /^[a-z_]+$/.test(stage) ? sql`${conversations.stage}::text = ${stage}` : undefined, search))
    .orderBy(desc(conversations.updatedAt))
    .limit(2000);
  const ctx = { now: Date.now(), me: me.id };
  const rows = list.filter((x) => matchesFilter(x.c, filter, ctx)).map(({ c, storeName }) => {
    const lead = ((c.memory as { lead?: Lead } | null)?.lead ?? {}) as Lead;
    return [c.profileName, c.channel, c.stage, c.leadScore, lead.storeName ?? storeName, lead.niche, lead.email, lead.whatsapp, lead.instagram ? `@${lead.instagram}` : "", formatDateTime(c.lastUserMessageAt), formatDateTime(c.createdAt)];
  });
  return csvResponse("conversations", toCsv(["الاسم", "القناة", "المرحلة", "الحرارة", "المتجر", "النشاط", "البريد", "واتساب", "إنستجرام", "آخر رسالة من العميل", "بداية المحادثة"], rows));
}
