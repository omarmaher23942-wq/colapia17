// sales-funnel.ts — أعداد قمع مبيعات الوكالة لفترة (قاعدة المنصة وحدها). كل استعلام مستقل بـ catch حتى لا يُسقط
// جدولٌ لم تُطبَّق migration الخاصة به بقيةَ القمع.
import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { FunnelCounts } from "@/lib/sales-funnel";

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

async function one(q: ReturnType<typeof sql>): Promise<Record<string, unknown>> {
  try {
    const r = await db.execute(q);
    return ((r.rows?.[0] ?? {}) as Record<string, unknown>) || {};
  } catch {
    return {};
  }
}

export async function salesFunnel(days: number): Promise<FunnelCounts> {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const [c, s, p] = await Promise.all([
    one(sql`
      select count(*) as n,
             count(*) filter (where nullif(memory->'lead'->>'niche','') is not null
                                and nullif(memory->'lead'->>'storeName','') is not null
                                and nullif(memory->'lead'->>'email','') is not null
                                and nullif(memory->'lead'->>'whatsapp','') is not null) as leads
      from conversations where created_at >= ${since}::timestamptz`),
    one(sql`
      select count(*) as created,
             count(*) filter (where s.setup_completed_at is not null) as setup_done,
             count(*) filter (where exists (select 1 from platform_payments pp where pp.store_id = s.id and pp.kind = 'setup' and pp.status = 'confirmed')) as paid,
             count(*) filter (where exists (select 1 from platform_payments pp where pp.store_id = s.id and pp.kind = 'setup' and pp.status = 'confirmed' and pp.plan = 'golden')) as paid_golden
      from stores s where s.source_conversation_id is not null and s.created_at >= ${since}::timestamptz`),
    one(sql`
      select coalesce(sum(amount_piasters) filter (where kind = 'setup'), 0) as revenue,
             count(*) filter (where kind = 'renewal') as renewals
      from platform_payments where status = 'confirmed' and coalesce(reviewed_at, created_at) >= ${since}::timestamptz`),
  ]);
  return {
    conversations: num(c.n),
    leads: num(c.leads),
    created: num(s.created),
    setupDone: num(s.setup_done),
    paid: num(s.paid),
    paidGolden: num(s.paid_golden),
    revenue: num(p.revenue),
    renewals: num(p.renewals),
  };
}
