// /admin/requests — طلبات المتاجر من الاستمارة، مرتبة بالمرحلة التي يراها العميل. «جديد» = لم يفتحه أحد من
// الفريق، و«متأخر» = تجاوز موعد التسليم الذي وُعد به العميل.
import Link from "next/link";
import { and, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { AlertTriangle, Inbox, Mail, MessageCircle, Search } from "lucide-react";
import { db } from "@/db/client";
import { storeRequests } from "@/db/schema/agency";
import { isMissingTable } from "@/intake/repo";
import { REQUEST_STAGES, STAGE_INFO } from "@/intake/stages";
import { AutoRefresh } from "@/components/platform/AutoRefresh";
import { ago, isLate } from "@/components/platform/requests/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VIEWS = {
  active: { label: "قيد التنفيذ", where: and(eq(storeRequests.status, "submitted"), ne(storeRequests.stage, "delivery")) },
  delivered: { label: "سُلِّمت", where: and(eq(storeRequests.status, "submitted"), eq(storeRequests.stage, "delivery")) },
  spam: { label: "سبام", where: eq(storeRequests.status, "spam") },
} as const;
type View = keyof typeof VIEWS;

export default async function RequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const view: View = sp.view === "delivered" || sp.view === "spam" ? sp.view : "active";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;

  let rows: (typeof storeRequests.$inferSelect)[] = [];
  let drafts = 0;
  let missing = false;
  try {
    [rows, [{ n: drafts = 0 } = { n: 0 }]] = await Promise.all([
      db
        .select()
        .from(storeRequests)
        .where(and(VIEWS[view].where, q ? or(ilike(storeRequests.code, like), ilike(storeRequests.storeName, like), ilike(storeRequests.email, like), ilike(storeRequests.whatsapp, like)) : undefined))
        .orderBy(desc(storeRequests.submittedAt))
        .limit(300),
      db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(storeRequests).where(and(eq(storeRequests.status, "draft"), sql`${storeRequests.expiresAt} > now()`)),
    ]);
  } catch (e) {
    if (!isMissingTable(e)) throw e;
    missing = true;
  }

  const now = new Date();
  const groups = view === "active" ? REQUEST_STAGES.filter((s) => s !== "delivery").map((s) => ({ key: s, title: STAGE_INFO[s].label, items: rows.filter((r) => r.stage === s) })) : [{ key: view, title: VIEWS[view].label, items: rows }];

  return (
    <div className="space-y-6">
      <AutoRefresh everyMs={20_000} />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <Inbox className="size-6 text-[#8fa8ff]" strokeWidth={1.75} aria-hidden="true" /> طلبات المتاجر
          </h1>
          <p className="mt-1 text-sm text-[#8d97c4]">من استمارة /start. حرّك كل طلب لمرحلته، والعميل يراها في صفحة متابعته.{drafts ? ` (${drafts} استمارة بدأها أصحابها ولم تُرسل بعد)` : ""}</p>
        </div>
        <form className="flex items-center gap-2" action="/admin/requests">
          <input type="hidden" name="view" value={view} />
          <label className="relative">
            <span className="sr-only">ابحث</span>
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[#8d97c4]" aria-hidden="true" />
            <input name="q" defaultValue={q} placeholder="الاسم، الكود، الرقم، البريد" className="h-10 w-64 rounded-xl border border-white/10 bg-white/[0.04] ps-9 pe-3 text-sm outline-none focus:border-[#6f86ff]" />
          </label>
        </form>
      </header>

      <nav className="flex gap-2" aria-label="عرض">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link key={v} href={`/admin/requests?view=${v}`} aria-current={v === view ? "page" : undefined} className={cn("rounded-xl px-3.5 py-2 text-xs font-black", v === view ? "bg-[#6f86ff] text-[#07091a]" : "bg-white/5 text-[#c3cdf0]")}>
            {VIEWS[v].label}
          </Link>
        ))}
      </nav>

      {missing ? (
        <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-bold text-amber-200">جداول الطلبات غير موجودة بعد. شغّل من جهازك: npm run db:migrate (migration 0006_agency_requests).</p>
      ) : null}

      <div className={cn("grid gap-4", view === "active" && "lg:grid-cols-4")}>
        {groups.map((g) => (
          <section key={g.key} className="space-y-3 rounded-3xl border border-white/10 bg-[#0b0f2a] p-3">
            <h2 className="flex items-center justify-between px-1 text-sm font-black">
              {g.title}
              <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[11px]">{g.items.length}</span>
            </h2>
            {g.items.length === 0 ? <p className="px-1 py-6 text-center text-xs text-[#8d97c4]">لا طلبات</p> : null}
            {g.items.map((r) => {
              const late = isLate(r, now);
              return (
                <Link key={r.id} href={`/admin/requests/${r.id}`} className="block rounded-2xl border border-white/10 bg-[#0e1424] p-3 transition hover:border-[#8fa8ff]/40">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-black text-white">{r.storeName || "بلا اسم"}</p>
                    {!r.seenAt ? <span className="shrink-0 rounded-full bg-[#6f86ff] px-2 py-0.5 text-[10px] font-black text-[#07091a]">جديد</span> : null}
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-[#8d97c4]">
                    {r.code} · {r.submittedAt ? ago(r.submittedAt, now) : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#c3cdf0]">
                    {r.whatsapp ? (
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="size-3.5 text-[#25D366]" aria-hidden="true" /> واتساب
                      </span>
                    ) : null}
                    {r.email ? (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="size-3.5" aria-hidden="true" /> {r.emailConfirmedAt ? "بريد مؤكد" : "بريد"}
                      </span>
                    ) : null}
                    {r.source !== "web" ? <span className="rounded bg-white/10 px-1.5">{r.source}</span> : null}
                    {late ? (
                      <span className="inline-flex items-center gap-1 text-rose-300">
                        <AlertTriangle className="size-3.5" aria-hidden="true" /> متأخر عن الوعد
                      </span>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
