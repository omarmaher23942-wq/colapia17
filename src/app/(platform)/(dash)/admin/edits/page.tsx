// /admin/edits — صندوق طلبات التعديل بعد التسليم (V4). بسيط عمداً: العميل والمشروع ورابط المستودع بارزاً وقابلاً للنسخ،
// نص الطلب وملفاته، الحالة، وتعليم المنجَز أو المدفوع. المالك يعدّل مستودع العميل بنفسه.
import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import { requirePlatformPage } from "@/server/platform-guard";
import { listEditRequests } from "@/server/repos/edit-requests";
import { AutoRefresh } from "@/components/platform/AutoRefresh";
import { EditCard } from "@/components/platform/EditInbox";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  ["open", "المفتوحة"],
  ["done", "المنجزة"],
  ["declined", "المعتذَر عنها"],
  ["all", "الكل"],
] as const;

export default async function EditsPage({ searchParams }: { searchParams: Promise<{ status?: string; request?: string }> }) {
  await requirePlatformPage({ cap: "requests.assign" });
  const sp = await searchParams;
  const status = TABS.some(([k]) => k === sp.status) ? (sp.status as (typeof TABS)[number][0]) : "open";
  const requestId = typeof sp.request === "string" && /^[0-9a-f-]{36}$/i.test(sp.request) ? sp.request : undefined;
  const rows = await listEditRequests({ status, requestId });

  return (
    <div className="mx-auto max-w-4xl space-y-5 text-[#eaf0ff]" dir="rtl">
      <AutoRefresh everyMs={30_000} />
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <MessageSquarePlus className="size-6 text-[#8fa8ff]" aria-hidden="true" /> طلبات التعديل
        </h1>
        <p className="mt-1 text-sm text-[#8d97c4]">طلبات العملاء بعد التسليم. تعديل مجاني واحد خلال النافذة، وما عداه برسوم تؤكدونها قبل التنفيذ.</p>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label="الحالة">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/admin/edits?status=${k}${requestId ? `&request=${requestId}` : ""}`} aria-current={k === status ? "page" : undefined} className={cn("inline-flex min-h-11 items-center rounded-xl px-3.5 text-xs font-black", k === status ? "bg-[#6f86ff] text-[#07091a]" : "bg-white/5 text-[#c3cdf0]")}>
            {label}
          </Link>
        ))}
        {requestId ? (
          <Link href={`/admin/edits?status=${status}`} className="ms-auto inline-flex min-h-11 items-center rounded-xl bg-white/5 px-3.5 text-xs font-black text-[#c3cdf0]">
            إلغاء تصفية المشروع
          </Link>
        ) : null}
      </nav>
      {rows.length === 0 ? <p className="rounded-3xl border border-dashed border-white/10 p-12 text-center text-sm text-[#8d97c4]">لا طلبات تعديل هنا.</p> : null}
      <div className="space-y-4">
        {rows.map((e) => (
          <div key={e.id} className="space-y-2">
            <EditCard e={{ ...e, createdAt: e.createdAt.toISOString(), doneAt: e.doneAt?.toISOString() ?? null }} />
            <Link href={`/admin/edits/${e.id}`} className="inline-flex min-h-11 items-center text-[12.5px] font-bold text-[#8fa8ff] underline">
              فتح الصفحة الكاملة
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
