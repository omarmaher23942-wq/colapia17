// /admin/outreach — قائمة تواصل Colapia مع براندات الملابس على إنستجرام (الدائرة الذهبية): إضافة الحسابات، ورسالة
// افتتاحية مخصصة لكل حساب، وجدول يومي متباعد، وإرسال من حساب Colapia بيد المالك، ثم يتسلّم الوكيل الرد.
import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { igLeads } from "@/db/schema";
import { requirePlatformPage } from "@/server/platform-guard";
import { outreachSettings, scheduleQueue } from "@/server/ig-outreach";
import { OutreachBoard, type LeadView } from "@/components/platform/OutreachBoard";
import { can } from "@/agency/roles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "التواصل مع البراندات" };

export default async function OutreachPage() {
  const u = await requirePlatformPage({ cap: "leads" });
  // أي حساب في الطابور بلا موعد (أضيف قبل ضبط الجدول أو أعيد للطابور) يأخذ موعده الآن.
  await scheduleQueue().catch(() => 0);
  const [rows, settings] = await Promise.all([
    db.select().from(igLeads).orderBy(desc(igLeads.createdAt)).limit(1500).catch(() => null),
    outreachSettings(),
  ]);
  if (!rows) {
    return (
      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6 text-sm text-amber-200">
        جدول قائمة التواصل غير موجود بعد في قاعدة البيانات. شغّل <code className="font-mono">npm run db:migrate</code> من جهازك ثم افتح الصفحة.
      </div>
    );
  }
  const leads: LeadView[] = rows.map((r) => ({
    id: r.id,
    handle: r.handle,
    brandName: r.brandName,
    category: r.category,
    note: r.note,
    status: r.status as LeadView["status"],
    message: r.message,
    messageSource: r.messageSource,
    scheduledFor: r.scheduledFor?.toISOString() ?? null,
    sentAt: r.sentAt?.toISOString() ?? null,
    conversationId: r.conversationId,
    createdAt: r.createdAt.toISOString(),
  }));
  return <OutreachBoard leads={leads} settings={settings} canEditSettings={can(u.role, "stores.manage")} />;
}
