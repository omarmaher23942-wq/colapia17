// /admin/requests — لوحة الإنتاج (V4): المشاريع المؤكَّد دفعها بأعمدة الحالات الداخلية (جديد ← مُسند ← قيد التجهيز ← بانتظار
// المراجعة ← جاهز). «جديد» على البطاقة = لم يفتحه أحد، و«+س» = تجاوز مهلة الحالة (من /admin/flags ← production). المنفّذ
// يرى ما أُسند إليه فقط. الحجوزات التي لم يُؤكَّد تحويلها تظهر في /admin/payments.
import Link from "next/link";
import { and, asc, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { Clock3, Crown, Inbox, Mail, MessageCircle, PauseCircle, Search, UserRound, Wallet } from "lucide-react";
import { db } from "@/db/client";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { storeRequests } from "@/db/schema/agency";
import { platformUsers } from "@/db/schema";
import { can, isPlatformRole } from "@/agency/roles";
import { overdueHours, PRODUCTION_INFO, type ProductionState } from "@/agency/production";
import { productionSla } from "@/agency/settings";
import { AutoRefresh } from "@/components/platform/AutoRefresh";
import { cn } from "@/lib/utils";
import { requirePlatformPage } from "@/server/platform-guard";

export const dynamic = "force-dynamic";

const VIEWS = {
  active: { label: "قيد التنفيذ", where: and(eq(storeRequests.status, "submitted"), ne(storeRequests.production, "delivered")) },
  delivered: { label: "سُلِّمت", where: and(eq(storeRequests.status, "submitted"), eq(storeRequests.production, "delivered")) },
  spam: { label: "مغلقة", where: or(eq(storeRequests.status, "spam"), eq(storeRequests.status, "withdrawn")) },
} as const;
const BOARD: ProductionState[] = ["new", "assigned", "building", "review", "ready"];
type View = keyof typeof VIEWS;

const ago = (d: Date, now: Date) => {
  const h = Math.floor((now.getTime() - d.getTime()) / 3_600_000);
  if (h < 1) return "منذ دقائق";
  if (h < 24) return `منذ ${h} ساعة`;
  return `منذ ${Math.floor(h / 24)} يوم`;
};

export default async function RequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requirePlatformPage();
  const sp = await searchParams;
  const role = isPlatformRole(me.role) ? me.role : "sales";
  const seesAll = can(role, "requests.view_all");
  // المنفّذ: ما أُسند إليه فقط دائماً. الباقون: «طلباتي» اختياري.
  const onlyMine = !seesAll || sp.who === "mine";
  const view: View = sp.view === "spam" && can(role, "requests.spam") ? "spam" : sp.view === "delivered" ? "delivered" : "active";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const phone = q ? normalizeEgyptianPhone(q) : null;

  const [rows, awaiting, team, sla] = await Promise.all([
    db
      .select()
      .from(storeRequests)
      .where(and(VIEWS[view].where, onlyMine ? or(eq(storeRequests.builderId, me.id), eq(storeRequests.reviewerId, me.id)) : undefined, q ? or(ilike(storeRequests.code, like), ilike(storeRequests.storeName, like), ilike(storeRequests.email, like), ilike(storeRequests.whatsapp, like), phone ? eq(storeRequests.whatsapp, phone) : undefined) : undefined))
      // الطابور من الأقدم (الأقرب لتجاوز الوعد)؛ المسلَّمة والمغلقة من الأحدث.
      .orderBy(view === "active" ? asc(storeRequests.confirmedAt) : desc(storeRequests.updatedAt))
      .limit(500)
      .catch(() => [] as (typeof storeRequests.$inferSelect)[]),
    db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(storeRequests).where(eq(storeRequests.status, "awaiting_payment")).catch(() => [{ n: 0 }]),
    db.select({ id: platformUsers.id, name: platformUsers.name }).from(platformUsers).catch(() => []),
    productionSla(),
  ]);
  const names = new Map(team.map((t) => [t.id, t.name]));
  const now = new Date();
  const groups = view === "active" ? BOARD.map((s) => ({ key: s, title: PRODUCTION_INFO[s].label, items: rows.filter((r) => r.production === s) })) : [{ key: view, title: VIEWS[view].label, items: rows }];
  const qs = (patch: Record<string, string | null>) => {
    const u = new URLSearchParams();
    const base = { view, who: onlyMine && seesAll ? "mine" : null, q: q || null, ...patch };
    for (const [k, v] of Object.entries(base)) if (v) u.set(k, v);
    return `/admin/requests?${u.toString()}`;
  };
  const pendingPay = awaiting[0]?.n ?? 0;

  return (
    <div className="space-y-6">
      <AutoRefresh everyMs={20_000} />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <Inbox className="size-6 text-[#8fa8ff]" strokeWidth={1.75} aria-hidden="true" /> {seesAll ? "المشاريع" : "مشاريعي"}
          </h1>
          <p className="mt-1 text-sm text-[#8d97c4]">{seesAll ? "تدخل المشروع هنا بعد أن تؤكدوا دفع العميل. أسندوه لمنفّذ ومراجع، وسلّموه من صفحته." : "المشاريع المسندة إليك للتجهيز أو المراجعة."}</p>
          {seesAll && pendingPay > 0 ? (
            <Link href="/admin/payments" className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400/15 px-3 text-[13px] font-black text-amber-200">
              <Wallet className="size-4" aria-hidden="true" /> {pendingPay} حجز بانتظار تأكيد الدفع
            </Link>
          ) : null}
        </div>
        <form className="flex items-center gap-2" action="/admin/requests">
          <input type="hidden" name="view" value={view} />
          {onlyMine && seesAll ? <input type="hidden" name="who" value="mine" /> : null}
          <label className="relative">
            <span className="sr-only">ابحث</span>
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[#8d97c4]" aria-hidden="true" />
            <input name="q" defaultValue={q} placeholder="الاسم، الكود، الرقم، البريد" className="h-11 w-64 max-w-full rounded-xl border border-white/10 bg-white/[0.04] ps-9 pe-3 text-sm outline-none focus:border-[#6f86ff]" />
          </label>
        </form>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="عرض">
        {(Object.keys(VIEWS) as View[])
          .filter((v) => v !== "spam" || can(role, "requests.spam"))
          .map((v) => (
            <Link key={v} href={qs({ view: v })} aria-current={v === view ? "page" : undefined} className={cn("inline-flex min-h-11 items-center rounded-xl px-3.5 text-xs font-black", v === view ? "bg-[#6f86ff] text-[#07091a]" : "bg-white/5 text-[#c3cdf0]")}>
              {VIEWS[v].label}
            </Link>
          ))}
        {seesAll ? (
          <Link href={qs({ who: onlyMine ? null : "mine" })} aria-current={onlyMine ? "page" : undefined} className={cn("ms-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-xs font-black", onlyMine ? "bg-emerald-400 text-[#07091a]" : "bg-white/5 text-[#c3cdf0]")}>
            <UserRound className="size-3.5" aria-hidden="true" /> طلباتي فقط
          </Link>
        ) : null}
      </nav>

      <div className={cn("grid gap-4", view === "active" && "md:grid-cols-2 xl:grid-cols-5")}>
        {groups.map((g) => (
          <section key={g.key} className="space-y-3 rounded-3xl border border-white/10 bg-[#0b0f2a] p-3">
            <h2 className="flex items-center justify-between px-1 text-sm font-black">
              {g.title}
              <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[11px]">{g.items.length}</span>
            </h2>
            {g.items.length === 0 ? <p className="px-1 py-6 text-center text-xs text-[#8d97c4]">لا مشاريع</p> : null}
            {g.items.map((r) => {
              const overdue = !r.waitingReason ? overdueHours(r.production as ProductionState, r.productionChangedAt ?? r.confirmedAt, sla, now) : 0;
              return (
                <Link key={r.id} href={`/admin/requests/${r.id}`} className="block rounded-2xl border border-white/10 bg-[#0e1424] p-3 transition hover:border-[#8fa8ff]/40">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-black text-white">{r.storeName || "بلا اسم"}</p>
                    <span className="flex shrink-0 gap-1">
                      {r.offer === "golden" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/20 px-2 py-0.5 text-[10px] font-black text-amber-200">
                          <Crown className="size-3" aria-hidden="true" /> ذهبية
                        </span>
                      ) : null}
                      {!r.seenAt && r.status === "submitted" ? <span className="rounded-full bg-[#6f86ff] px-2 py-0.5 text-[10px] font-black text-[#07091a]">جديد</span> : null}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-[#8d97c4]">
                    {r.code}
                    {r.confirmedAt ? ` · أُكِّد ${ago(r.confirmedAt, now)}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#c3cdf0]">
                    {r.whatsapp ? (
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="size-3.5 text-[#25D366]" aria-hidden="true" /> واتساب
                      </span>
                    ) : null}
                    {r.email ? (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="size-3.5" aria-hidden="true" /> بريد
                      </span>
                    ) : null}
                    {overdue > 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-300">
                        <Clock3 className="size-3.5" aria-hidden="true" /> +{overdue} س
                      </span>
                    ) : null}
                    {r.waitingReason ? (
                      <span className="inline-flex items-center gap-1 text-amber-200" title={r.waitingReason}>
                        <PauseCircle className="size-3.5" aria-hidden="true" /> بانتظار العميل
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-[#8d97c4]">
                    <span>منفّذ: {r.builderId ? (names.get(r.builderId) ?? "—") : <b className="text-amber-300">بلا</b>}</span>
                    {r.reviewerId ? <span>مراجع: {names.get(r.reviewerId) ?? "—"}</span> : null}
                  </p>
                </Link>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
