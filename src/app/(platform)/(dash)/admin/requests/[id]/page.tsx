// /admin/requests/[id] — مشروع واحد: بيانات الحجز، الدفع، الإنتاج (الإسناد والفحص والتسليم)، رابطا المستودع والمتجر،
// رسالة التسليم الجاهزة بعد التسليم، وسجل الطلب. تنزيل المشروع نفسه من /admin/requests/[id]/project.
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { ArrowRight, Crown, Download, ExternalLink, Mail, MessageCircle } from "lucide-react";
import { db } from "@/db/client";
import { editRequests, platformPayments, platformUsers, storeRequestEvents, storeRequests } from "@/db/schema";
import { can, isPlatformRole } from "@/agency/roles";
import { canViewRequest, overdueHours, readQa, type ProductionState } from "@/agency/production";
import { productionSla } from "@/agency/settings";
import { accountUrl } from "@/agency/client-notify";
import { deliveryMessage } from "@/agent/handoff-messages";
import { clientStatus } from "@/agency/status";
import { ProvisionPanel } from "@/components/platform/requests/ProvisionPanel";
import { isBuildData } from "@/agency/provision-plan";
import { ProductionPanel } from "@/components/platform/requests/ProductionPanel";
import { CopyButton, ProjectLinks } from "@/components/platform/requests/ProjectLinks";
import { fmtEgp, freeEditDeadline } from "@/lib/platform-pricing";
import { currentPricing } from "@/server/pricing";
import { requirePlatformPage } from "@/server/platform-guard";
import { waLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const card = "rounded-3xl border border-white/10 bg-[#0b0f2a] p-4 sm:p-5";
const METHOD: Record<string, string> = { vodafone_cash: "فودافون كاش", instapay: "إنستاباي" };
const PAY_STATUS: Record<string, string> = { under_review: "قيد المراجعة", confirmed: "مؤكدة", rejected: "مرفوضة" };
const day = (d: Date | null) => (d ? d.toLocaleString("ar-EG", { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" }) : "—");

type Booking = { store?: { name?: string; niche?: string; instagram?: { handle?: string; url?: string } }; contact?: { whatsapp?: string; email?: string }; styleNotes?: string; consent?: { collab?: boolean } };

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePlatformPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const role = isPlatformRole(me.role) ? me.role : "sales";
  const [row] = await db.select().from(storeRequests).where(eq(storeRequests.id, id)).limit(1);
  if (!row || row.status === "draft" || !canViewRequest(row, { id: me.id, role })) notFound();

  const [events, pays, editCount, team, sla, pricing] = await Promise.all([
    db.select().from(storeRequestEvents).where(eq(storeRequestEvents.requestId, id)).orderBy(desc(storeRequestEvents.createdAt)).limit(40),
    db.select().from(platformPayments).where(eq(platformPayments.requestId, id)).orderBy(desc(platformPayments.createdAt)),
    db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(editRequests).where(eq(editRequests.requestId, id)),
    db.select({ id: platformUsers.id, name: platformUsers.name, role: platformUsers.role }).from(platformUsers).where(eq(platformUsers.isActive, true)),
    productionSla(),
    currentPricing(),
  ]);
  // أول فتح يعلّم الطلب «مقروءاً» (شارة «جديد» في اللوحة).
  if (!row.seenAt && row.status === "submitted") await db.update(storeRequests).set({ seenAt: new Date(), seenBy: me.id }).where(and(eq(storeRequests.id, id), sql`${storeRequests.seenAt} is null`)).catch(() => {});

  const data = (row.data ?? {}) as Booking;
  const st = clientStatus(row);
  const members = team.filter((t) => isPlatformRole(t.role)).map((t) => ({ id: t.id, name: t.name, role: t.role as import("@/agency/roles").PlatformRole }));
  const overdue = row.waitingReason ? 0 : overdueHours(row.production as ProductionState, row.productionChangedAt ?? row.confirmedAt, sla);
  const canLinks = can(role, "requests.assign") || (row.builderId === me.id && can(role, "requests.work"));
  const delivered = row.production === "delivered" && row.status === "submitted";
  const message = delivered
    ? deliveryMessage({ storeName: row.storeName ?? "", repoUrl: row.repoUrl, storeUrl: row.storeUrl, accountUrl: accountUrl(), freeEditUntil: row.freeEditUntil ?? freeEditDeadline(row.deliveredAt ?? new Date(), pricing.edit.freeDays), freeDays: pricing.edit.freeDays })
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-5 text-[#eaf0ff]" dir="rtl">
      <Link href="/admin/requests" className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-bold text-[#8fa8ff]">
        <ArrowRight className="size-4" aria-hidden="true" /> المشاريع
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-black">
            {row.storeName || "بلا اسم"}
            {row.offer === "golden" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/20 px-2.5 py-0.5 text-[11px] font-black text-amber-200">
                <Crown className="size-3.5" aria-hidden="true" /> الدائرة الذهبية
              </span>
            ) : null}
          </h1>
          <p className="mt-1 font-mono text-[12px] text-[#8d97c4]">
            {row.code} · {st.label}
          </p>
        </div>
        {row.status === "submitted" ? (
          <a href={`/admin/requests/${row.id}/project`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-[13px] font-black text-white">
            <Download className="size-4" aria-hidden="true" /> تنزيل المشروع
          </a>
        ) : null}
      </header>

      {row.status === "awaiting_payment" ? (
        <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-[13.5px] font-bold leading-7 text-amber-100">
          هذا الحجز بانتظار تأكيد التحويل. أكِّدوه من <Link href={`/admin/payments?focus=${pays[0]?.id ?? ""}`} className="underline">صفحة التحويلات</Link> فيدخل الإنتاج.
        </p>
      ) : null}

      <section className={card}>
        <h2 className="mb-3 text-sm font-black">بيانات الحجز</h2>
        <dl className="grid gap-x-6 gap-y-3 text-[13.5px] sm:grid-cols-2">
          <div><dt className="text-[#8d97c4]">النشاط</dt><dd className="font-bold">{data.store?.niche || "—"}</dd></div>
          <div>
            <dt className="text-[#8d97c4]">إنستجرام</dt>
            <dd className="font-bold" dir="ltr">
              {data.store?.instagram?.url ? <a href={data.store.instagram.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">@{data.store.instagram.handle}<ExternalLink className="size-3.5" aria-hidden="true" /></a> : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[#8d97c4]">واتساب</dt>
            <dd className="font-bold" dir="ltr">
              {row.whatsapp ? <a href={waLink(row.whatsapp, "") ?? "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline"><MessageCircle className="size-3.5" aria-hidden="true" />{row.whatsapp}</a> : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[#8d97c4]">البريد (حساب العميل)</dt>
            <dd className="font-bold" dir="ltr">{row.email ? <a href={`mailto:${row.email}`} className="inline-flex items-center gap-1 underline"><Mail className="size-3.5" aria-hidden="true" />{row.email}</a> : "—"}</dd>
          </div>
          {data.styleNotes ? <div className="sm:col-span-2"><dt className="text-[#8d97c4]">ملاحظات الأسلوب</dt><dd className="whitespace-pre-wrap font-medium leading-7">{data.styleNotes}</dd></div> : null}
          {row.offer === "golden" ? <div><dt className="text-[#8d97c4]">موافقة التعاون</dt><dd className="font-bold">{data.consent?.collab ? "موافق" : "—"}</dd></div> : null}
        </dl>
      </section>

      <section className={card}>
        <h2 className="mb-3 text-sm font-black">التحويلات</h2>
        {pays.length === 0 ? <p className="text-[13px] text-[#8d97c4]">لا تحويلات.</p> : null}
        <ul className="space-y-2">
          {pays.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.03] p-3 text-[13px]">
              <span className="font-bold">{fmtEgp(p.amountPiasters / 100)} ج · {METHOD[p.method] ?? p.method} · {p.kind === "edit" ? "رسوم تعديل" : p.plan === "golden" ? "الدائرة الذهبية" : "سعر عادي"}</span>
              <span className="flex items-center gap-3">
                <span className="text-[#c3cdf0]">{PAY_STATUS[p.status] ?? p.status}</span>
                {p.screenshotUrl ? <a href={p.screenshotUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">الإيصال</a> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {row.status === "submitted" && isBuildData(row.data) && (can(role, "requests.deliver") || (row.builderId === me.id && can(role, "requests.work"))) ? (
        <section className={card}>
          <h2 className="mb-1 text-sm font-black">التجهيز ورابط الإعداد</h2>
          <p className="mb-3 text-[12.5px] leading-6 text-[#8d97c4]">ينشئ متجر معاينة مخفياً بحالة «إعداد» بلا عدّاد؛ يبدأ العدّاد عند أول فتح للرابط.</p>
          <ProvisionPanel id={row.id} provisioned={Boolean(row.storeId)} suggestedSlug={row.slug} />
        </section>
      ) : null}

      {row.status === "submitted" ? (
        <section className={card}>
          <h2 className="mb-3 text-sm font-black">الإنتاج</h2>
          <ProductionPanel id={row.id} me={{ id: me.id, role }} production={row.production as ProductionState} builderId={row.builderId} reviewerId={row.reviewerId} qa={readQa(row.qa)} waitingReason={row.waitingReason} members={members} round={row.round} overdue={overdue} />
        </section>
      ) : null}

      {row.status === "submitted" ? (
        <section className={card}>
          <h2 className="mb-1 text-sm font-black">سجل التسليم</h2>
          <p className="mb-3 text-[12.5px] leading-6 text-[#8d97c4]">
            {delivered ? `سُلِّم ${day(row.deliveredAt)} · التعديل المجاني حتى ${day(row.freeEditUntil)} · ${editCount[0]?.n ?? 0} طلب تعديل` : "املؤوا الرابطين بعد جلسة التسليم؛ يظهران للعميل في بوابته."}
            {delivered ? (
              <>
                {" "}
                <Link href={`/admin/edits?request=${row.id}`} className="underline">طلبات التعديل</Link>
              </>
            ) : null}
          </p>
          <ProjectLinks id={row.id} repoUrl={row.repoUrl} storeUrl={row.storeUrl} canEdit={canLinks} />
          {message ? (
            <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-[#050716] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[13px] font-black">رسالة التسليم (تُحدَّث بالروابط المحفوظة)</h3>
                <CopyButton value={message} label="نسخ الرسالة" />
              </div>
              <pre dir="rtl" className="whitespace-pre-wrap text-[12.5px] leading-7 text-[#c3cdf0]">{message}</pre>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className={card}>
        <h2 className="mb-3 text-sm font-black">السجل</h2>
        <ol className="space-y-2 text-[13px]">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-3 rounded-xl bg-white/[0.03] px-3 py-2">
              <span className="text-[11.5px] text-[#8d97c4]">{day(e.createdAt)}</span>
              <span className="font-medium leading-6">{e.internalNote ?? e.clientNote ?? e.type}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
