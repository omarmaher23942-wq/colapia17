// /admin/conversations/delivery — «بانتظار التسليم» (V3 A6): المتاجر التي أنشأها الوكيل بعد موافقة العميل وما زالت في الإعداد.
// قسمان: لم يُسلَّم رابطها بعد (الأقدم أولاً، فهو الأولى)، وسُلِّم الرابط وينتظر صاحبه إكمال الإعداد.
import Link from "next/link";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { ArrowRight, PackageCheck } from "lucide-react";
import { db } from "@/db/client";
import { conversations, merchants, stores } from "@/db/schema";
import { requirePlatformPage } from "@/server/platform-guard";
import { handoffColumns, handoffFromRow } from "@/agent/handoff-data";
import { handoffMessage } from "@/agent/handoff-messages";
import { DeliveryList, type DeliveryItem } from "@/components/platform/DeliveryList";
import { AutoRefresh } from "@/components/platform/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function DeliveryPage() {
  await requirePlatformPage({ cap: "conversations" });

  const rows = await db
    .select({ ...handoffColumns, createdAt: stores.createdAt, convId: conversations.id, person: conversations.profileName, channel: conversations.channel })
    .from(stores)
    .leftJoin(merchants, eq(merchants.id, stores.merchantId))
    .leftJoin(conversations, eq(conversations.id, stores.sourceConversationId))
    .where(and(eq(stores.status, "setup"), isNotNull(stores.sourceConversationId)))
    .orderBy(asc(stores.createdAt))
    .limit(200);

  const items: DeliveryItem[] = rows.map((r) => {
    const h = handoffFromRow(r);
    return {
      storeId: r.id,
      storeName: r.name,
      subdomain: r.subdomain,
      email: r.email ?? null,
      createdAt: r.createdAt.toISOString(),
      linkSentAt: h.linkSentAt,
      conversationId: r.convId ?? null,
      person: r.person ?? null,
      channel: r.channel ?? null,
      setupMessage: handoffMessage("setup", h),
      loginMessage: handoffMessage("login", h),
    };
  });
  const waiting = items.filter((i) => !i.linkSentAt);
  const delivered = items.filter((i) => i.linkSentAt);

  return (
    <div className="mx-auto max-w-3xl space-y-6" dir="rtl">
      <AutoRefresh everyMs={30000} />
      <header className="space-y-2">
        <Link href="/admin/conversations" className="inline-flex items-center gap-1 text-xs font-bold text-[#8fa8ff] hover:underline">
          <ArrowRight className="size-3.5" aria-hidden="true" /> المحادثات
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-black text-white">
          <PackageCheck className="size-6 text-[#8fa8ff]" aria-hidden="true" />
          بانتظار التسليم
        </h1>
        <p className="text-[12.5px] leading-6 text-slate-400">
          متاجر أنشأها المساعد بعد موافقة أصحابها، والمحادثة الآن لكم. رابط الإعداد لا يُرسل آلياً: انسخوا الرسالة وأرسلوها في الوقت المناسب، ومن لحظة التسليم تبدأ التذكيرات ومهلة حذف المتجر غير المكتمل.
        </p>
      </header>

      <section aria-labelledby="w-title" className="space-y-3">
        <h2 id="w-title" className="text-sm font-black text-white">
          لم يُسلَّم بعد ({waiting.length})
        </h2>
        <DeliveryList items={waiting} empty="لا متاجر تنتظر التسليم الآن." />
      </section>

      <section aria-labelledby="d-title" className="space-y-3">
        <h2 id="d-title" className="text-sm font-black text-white">
          سُلِّم الرابط وينتظر إكمال الإعداد ({delivered.length})
        </h2>
        <DeliveryList items={delivered} empty="لا متاجر في هذه المرحلة." />
      </section>
    </div>
  );
}
