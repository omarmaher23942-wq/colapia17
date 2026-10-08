import { desc, inArray, eq } from "drizzle-orm";
import { Workflow, Search, Filter } from "lucide-react";
import { db } from "@/db/client";
import { stores, merchants } from "@/db/schema";
import { KanbanPipeline } from "@/components/platform/KanbanPipeline";
import { AutoRefresh } from "@/components/platform/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  const rows = await db
    .select({
      id: stores.id,
      name: stores.name,
      subdomain: stores.subdomain,
      status: stores.status,
      deliverAt: stores.deliverAt,
      trialEndsAt: stores.trialEndsAt,
      merchantName: merchants.displayName,
    })
    .from(stores)
    .leftJoin(merchants, eq(merchants.id, stores.merchantId))
    .where(inArray(stores.status, ["pending_review", "building", "review", "trial", "active"]))
    .orderBy(desc(stores.updatedAt));

  const filtered = q
    ? rows.filter(r => r.name.includes(q) || r.subdomain.includes(q) || (r.merchantName && r.merchantName.includes(q)))
    : rows;

  return (
    <div className="space-y-6 h-[calc(100vh-6rem)] flex flex-col" dir="rtl">
      <AutoRefresh everyMs={10000} />

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="size-5 text-[#8fa8ff]" strokeWidth={1.75} />
            <h1 className="text-2xl font-black text-white">خط الإنتاج والتسليم (Kanban)</h1>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            سحب وإفلات المتاجر بين المراحل. التحديثات تنعكس فورياً.
          </p>
        </div>

        <form className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute end-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
            <input
              name="q"
              defaultValue={q}
              placeholder="ابحث عن متجر أو تاجر..."
              className="h-10 w-64 rounded-xl border border-white/10 bg-[#0e1424] px-3 pe-9 text-xs text-white outline-none focus:border-[#8fa8ff]"
            />
          </div>
          <button type="submit" className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10">
            <Filter className="size-4" />
          </button>
        </form>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <KanbanPipeline 
          initialStores={filtered.map(r => ({
            ...r,
            merchantName: r.merchantName ?? "",
            deliverAt: r.deliverAt?.toISOString() ?? null,
            trialEndsAt: r.trialEndsAt?.toISOString() ?? null,
          }))} 
        />
      </div>
    </div>
  );
}