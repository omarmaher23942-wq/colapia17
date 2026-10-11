// /admin/requests — لوحة الإنتاج: طلبات المتاجر بأعمدة حالات الإنتاج الداخلية (جديد ← مُسند ← قيد البناء ← بانتظار
// المراجعة ← جاهز). «جديد» على البطاقة = لم يفتحه أحد، و«متأخر عن الوعد» = تجاوز موعد التسليم الذي رآه العميل،
// و«متأخر داخلياً» = تجاوز مهلة الحالة (من /admin/flags ← production). المنفّذ يرى ما أُسند إليه فقط.
import Link from "next/link";
import { and, asc, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { AlertTriangle, Clock3, Inbox, Mail, MessageCircle, PauseCircle, Search, UserRound } from "lucide-react";
import { db } from "@/db/client";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { storeRequests } from "@/db/schema/agency";
import { isMissingTable, openQueueLength } from "@/intake/repo";
import { intakeSettings } from "@/intake/guard";
import { estimateEta, etaText } from "@/intake/eta";
import { STAGE_INFO } from "@/intake/stages";
import { platformUsers } from "@/db/schema";
import { can, isPlatformRole } from "@/agency/roles";
import { overdueHours, PRODUCTION_INFO, type ProductionState } from "@/agency/production";
import { productionSla } from "@/agency/settings";
import { AutoRefresh } from "@/components/platform/AutoRefresh";
import { ago, isLate, SOURCE_LABEL } from "@/components/platform/requests/format";
import { cn } from "@/lib/utils";
import { requirePlatformPage } from "@/server/platform-guard";

export const dynamic = "force-dynamic";

const VIEWS = {
  active: { label: "قيد التنفيذ", where: and(eq(storeRequests.status, "submitted"), ne(storeRequests.production, "delivered")) },
  delivered: { label: "سُلِّمت", where: and(eq(storeRequests.status, "submitted"), eq(storeRequests.production, "delivered")) },
  spam: { label: "سبام", where: eq(storeRequests.status, "spam") },
} as const;
const BOARD: ProductionState[] = ["new", "assigned", "building", "review", "ready"];
type View = keyof typeof VIEWS;

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
  // الرقم يُبحث بصيغته القياسية (01xxxxxxxxx) أياً كانت طريقة كتابته: +20 أو مسافات أو أرقام هندية.
  const phone = q ? normalizeEgyptianPhone(q) : null;

  let rows: (typeof storeRequests.$inferSelect)[] = [];
  let drafts = 0;
  let missing = false;
  try {
    [rows, [{ n: drafts = 0 } = { n: 0 }]] = await Promise.all([
      db
        .select()
        .from(storeRequests)
        .where(and(VIEWS[view].where, onlyMine ? or(eq(storeRequests.builderId, me.id), eq(storeRequests.reviewerId, me.id)) : undefined, q ? or(ilike(storeRequests.code, like), ilike(storeRequests.storeName, like), ilike(storeRequests.email, like), ilike(storeRequests.whatsapp, like), phone ? eq(storeRequests.whatsapp, phone) : undefined) : undefined))
        // الطابور من الأقدم (الأقرب لتجاوز الوعد)؛ المسلَّمة والسبام من الأحدث. والسقف لا يُسقط الأقدم الأكثر تأخراً.
        .orderBy(view === "active" ? asc(storeRequests.submittedAt) : desc(storeRequests.submittedAt))
        .limit(500),
      db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(storeRequests).where(and(eq(storeRequests.status, "draft"), sql`${storeRequests.expiresAt} > now()`)),
    ]);
  } catch (e) {
    if (!isMissingTable(e)) throw e;
    missing = true;
  }

  // الوعد الذي سيراه عميل جديد الآن (من طول الطابور وطاقة الفريق اليومية): يعرفه الفريق قبل أن يلتزم به.
  let promise: string | null = null;
  let capacity = 0;
  if (!missing) {
    await Promise.all([openQueueLength(), intakeSettings()])
      .then(([ahead, st]) => {
        capacity = st.capacityPerDay;
        promise = etaText(estimateEta(ahead, st.capacityPerDay));
      })
      .catch(() => {});
  }

  const now = new Date();
  const [sla, team] = missing ? [null, []] : await Promise.all([productionSla(), db.select({ id: platformUsers.id, name: platformUsers.name }).from(platformUsers)]);
  const names = new Map(team.map((t) => [t.id, t.name]));
  const groups = view === "active" ? BOARD.map((s) => ({ key: s, title: PRODUCTION_INFO[s].label, items: rows.filter((r) => r.production === s) })) : [{ key: view, title: VIEWS[view].label, items: rows }];
  const qs = (patch: Record<string, string | null>) => {
    const u = new URLSearchParams();
    const base = { view, who: onlyMine && seesAll ? "mine" : null, q: q || null, ...patch };
    for (const [k, v] of Object.entries(base)) if (v) u.set(k, v);
    return `/admin/requests?${u.toString()}`;
  };

  return (
    <div className="space-y-6">
      <AutoRefresh everyMs={20_000} />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <Inbox className="size-6 text-[#8fa8ff]" strokeWidth={1.75} aria-hidden="true" /> {seesAll ? "طلبات المتاجر" : "متاجري"}
          </h1>
          <p className="mt-1 text-sm text-[#8d97c4]">
            {seesAll ? "من استمارة /start. أسند كل طلب لمنفّذ ومراجع، وحالة الإنتاج تدفع المرحلة التي يراها العميل." : "المتاجر المسندة إليك للبناء أو المراجعة."}
            {seesAll && drafts ? ` (${drafts} استمارة بدأها أصحابها ولم تُرسل بعد)` : ""}
          </p>
          {promise && seesAll ? (
            <p className="mt-1 text-xs text-[#8d97c4]">
              الوعد الحالي للعملاء الجدد: <b className="text-[#c3cdf0]">{promise}</b> (طاقة الفريق المضبوطة {capacity} متاجر يومياً، وتُعدَّل من إعداد «intake» في <Link href="/admin/flags" className="underline">الإعدادات</Link>).
            </p>
          ) : null}
        </div>
        <form className="flex items-center gap-2" action="/admin/requests">
          <input type="hidden" name="view" value={view} />
          {onlyMine && seesAll ? <input type="hidden" name="who" value="mine" /> : null}
          <label className="relative">
            <span className="sr-only">ابحث</span>
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[#8d97c4]" aria-hidden="true" />
            <input name="q" defaultValue={q} placeholder="الاسم، الكود، الرقم، البريد" className="h-10 w-64 rounded-xl border border-white/10 bg-white/[0.04] ps-9 pe-3 text-sm outline-none focus:border-[#6f86ff]" />
          </label>
        </form>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="عرض">
        {(Object.keys(VIEWS) as View[])
          .filter((v) => v !== "spam" || can(role, "requests.spam"))
          .map((v) => (
            <Link key={v} href={qs({ view: v })} aria-current={v === view ? "page" : undefined} className={cn("rounded-xl px-3.5 py-2 text-xs font-black", v === view ? "bg-[#6f86ff] text-[#07091a]" : "bg-white/5 text-[#c3cdf0]")}>
              {VIEWS[v].label}
            </Link>
          ))}
        {seesAll ? (
          <Link href={qs({ who: onlyMine ? null : "mine" })} aria-pressed={onlyMine} className={cn("ms-auto inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black", onlyMine ? "bg-emerald-400 text-[#07091a]" : "bg-white/5 text-[#c3cdf0]")}>
            <UserRound className="size-3.5" aria-hidden="true" /> طلباتي فقط
          </Link>
        ) : null}
      </nav>

      {missing ? (
        <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-bold text-amber-200">جداول الطلبات غير موجودة بعد. شغّل من جهازك: npm run db:migrate (migration 0006_agency_requests).</p>
      ) : null}

      <div className={cn("grid gap-4", view === "active" && "md:grid-cols-2 xl:grid-cols-5")}>
        {groups.map((g) => (
          <section key={g.key} className="space-y-3 rounded-3xl border border-white/10 bg-[#0b0f2a] p-3">
            <h2 className="flex items-center justify-between px-1 text-sm font-black">
              {g.title}
              <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[11px]">{g.items.length}</span>
            </h2>
            {g.items.length === 0 ? <p className="px-1 py-6 text-center text-xs text-[#8d97c4]">لا طلبات</p> : null}
            {g.items.map((r) => {
              const late = isLate(r, now);
              const overdue = sla && !r.waitingReason ? overdueHours(r.production as ProductionState, r.productionChangedAt, sla, now) : 0;
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
                    {r.source !== "web" ? <span className="rounded bg-white/10 px-1.5">{SOURCE_LABEL[r.source] ?? r.source}</span> : null}
                    {late ? (
                      <span className="inline-flex items-center gap-1 text-rose-300">
                        <AlertTriangle className="size-3.5" aria-hidden="true" /> متأخر عن الوعد
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
                    {view !== "active" ? null : <span>العميل يرى: {r.stage ? STAGE_INFO[r.stage].label : "—"}</span>}
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
