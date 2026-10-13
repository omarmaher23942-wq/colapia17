// sales-funnel.ts — أعداد قمع مبيعات الوكالة لفترة (قاعدة المنصة وحدها). كل استعلام مستقل بـ catch حتى لا يُسقط
// جدولٌ لم تُطبَّق migration الخاصة به (ig_leads قبل 0013) بقيةَ القمع.
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
  const [o, c, r, s, p] = await Promise.all([
    one(sql`
      select count(*) as sent,
             count(*) filter (where replied_at is not null) as replied,
             count(*) filter (where status in ('form','won')) as reached_form
      from ig_leads where sent_at >= ${since}::timestamptz`),
    one(sql`select count(*) as n from conversations where created_at >= ${since}::timestamptz`),
    one(sql`select count(*) as n from store_requests where submitted_at >= ${since}::timestamptz and status <> 'spam'`),
    one(sql`
      select count(*) as delivered,
             count(*) filter (where exists (select 1 from platform_payments pp where pp.store_id = s.id and pp.kind = 'setup' and pp.status = 'confirmed')) as cohort_paid
      from stores s where s.delivered_at >= ${since}::timestamptz`),
    one(sql`
      select count(*) filter (where kind = 'setup') as paid,
             coalesce(sum(amount_piasters) filter (where kind = 'setup'), 0) as revenue,
             count(*) filter (where kind = 'renewal') as renewals
      from platform_payments where status = 'confirmed' and coalesce(reviewed_at, created_at) >= ${since}::timestamptz`),
  ]);
  return {
    outreach: { sent: num(o.sent), replied: num(o.replied), reachedForm: num(o.reached_form) },
    conversations: num(c.n),
    submitted: num(r.n),
    delivered: num(s.delivered),
    deliveredCohortPaid: num(s.cohort_paid),
    paid: num(p.paid),
    revenue: num(p.revenue),
    renewals: num(p.renewals),
  };
}
