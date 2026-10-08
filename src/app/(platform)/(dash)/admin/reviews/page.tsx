// Owner reviews moderation page:
// - Tabs: pending | approved | featured | all.
// - Audio player + rating + approve/feature/reject actions.
import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  Star,
  Volume2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Trash2,
  Inbox,
  Filter,
} from "lucide-react";
import { db } from "@/db/client";
import { platformReviews } from "@/db/schema/platform";
import { cn } from "@/lib/utils";
import { ReviewsList } from "@/components/platform/ReviewsList";

export const dynamic = "force-dynamic";

type Tab = "pending" | "approved" | "featured" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "بانتظار الاعتماد" },
  { key: "approved", label: "معتمدة" },
  { key: "featured", label: "مميّزة" },
  { key: "all", label: "الكل" },
];

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab: Tab =
    tabParam === "approved" || tabParam === "featured" || tabParam === "all"
      ? tabParam
      : "pending";

  // عدادات
  const [counts] = await db
    .select({
      pending: sql<number>`count(*) filter (where ${platformReviews.isApproved} = false)`.mapWith(Number),
      approved: sql<number>`count(*) filter (where ${platformReviews.isApproved} = true)`.mapWith(Number),
      featured: sql<number>`count(*) filter (where ${platformReviews.isFeatured} = true)`.mapWith(Number),
      all: sql<number>`count(*)`.mapWith(Number),
    })
    .from(platformReviews);

  const where =
    tab === "pending"
      ? eq(platformReviews.isApproved, false)
      : tab === "approved"
        ? eq(platformReviews.isApproved, true)
        : tab === "featured"
          ? eq(platformReviews.isFeatured, true)
          : undefined;

  const rows = await db
    .select()
    .from(platformReviews)
    .where(where)
    .orderBy(
      desc(platformReviews.isFeatured),
      desc(platformReviews.createdAt)
    )
    .limit(120);

  const countsByTab: Record<Tab, number> = {
    pending: counts?.pending ?? 0,
    approved: counts?.approved ?? 0,
    featured: counts?.featured ?? 0,
    all: counts?.all ?? 0,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-5">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-white sm:text-3xl">
            <Star
              className="size-6 text-amber-400"
              strokeWidth={2}
              aria-hidden="true"
            />
            اعتماد مراجعات التجار
          </h1>
          <p className="mt-1 text-xs text-[#8d97c4]">
            اعتماد التقييمات النصية والصوتية لإظهارها على صفحة الهبوط.
          </p>
        </div>
        <div className="text-end text-[11px] font-mono text-[#8d97c4]">
          <div>{counts?.all ?? 0} إجمالي</div>
          <div className="text-amber-300">{counts?.pending ?? 0} بانتظار</div>
        </div>
      </header>

      {/* Tabs */}
      <nav
        aria-label="تصفية المراجعات"
        className="flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-white/[0.02] p-1.5"
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          const c = countsByTab[t.key];
          return (
            <Link
              key={t.key}
              href={`/admin/reviews?tab=${t.key}`}
              scroll={false}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-xs font-bold transition-colors",
                active
                  ? "bg-[#6f86ff] text-white shadow"
                  : "text-[#c3cdf0] hover:bg-white/[0.04]"
              )}
            >
              <Filter
                className="size-3.5"
                strokeWidth={2.25}
                aria-hidden="true"
              />
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 font-mono text-[10.5px]",
                  active ? "bg-black/25" : "bg-white/5"
                )}
              >
                {c}
              </span>
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-20 text-center">
          <Inbox
            className="size-10 opacity-30"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-bold text-white">
            لا توجد مراجعات في هذا التصنيف
          </p>
          <p className="mt-1 text-xs text-[#8d97c4]">
            ستظهر هنا فور وصول تقييمات من التجار.
          </p>
        </div>
      ) : (
        <ReviewsList
          rows={rows.map((r) => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
          }))}
        />
      )}
    </div>
  );
}