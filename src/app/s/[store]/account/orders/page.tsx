// Orders list — يعرض كل طلبات المشتري مع pagination بسيطة.
import Link from "next/link";
import { notFound } from "next/navigation";
import { Package, ArrowLeft } from "lucide-react";
import { requireStore } from "@/lib/tenant";
import { getCustomerSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { orders } from "@/db/schema/commerce";
import { and, desc, eq } from "drizzle-orm";
import { formatEgp } from "@/lib/money";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SW = 1.75;
const PAGE_SIZE = 20;

const STATUS_LABEL: Record<string, string> = {
  new: "جديد",
  confirmed: "مؤكد",
  preparing: "قيد التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
  returned: "مُرتجع",
};

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { store: sub } = await params;
  const { page: pageParam } = await searchParams;
  const store = await requireStore(sub);
  const session = await getCustomerSession(store.id);
  if (!session) notFound();

  const page = Math.max(1, Number(pageParam) || 1);

  const db = await getTenantDb(store.id);
  const rows = await db
    .select({
      id: orders.id,
      code: orders.code,
      status: orders.status,
      total: orders.totalPiasters,
      createdAt: orders.createdAt,
      itemsCount: orders.id, // placeholder — نحتاج join للحصول على العدّ الحقيقي، لكن نعرض مؤقتاً العدد من الواجهة التفصيلية.
    })
    .from(orders)
    .where(
      and(eq(orders.storeId, store.id), eq(orders.customerId, session.customerId))
    )
    .orderBy(desc(orders.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const hasMore = rows.length === PAGE_SIZE;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-black">طلباتي</h1>
          <p className="mt-1 text-xs opacity-70">
            تتبّع شحناتك الحالية، واستعرض طلباتك السابقة
          </p>
        </div>
      </header>

      {rows.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 rounded-3xl border py-16 text-center"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <Package className="size-10 opacity-25" strokeWidth={SW} aria-hidden="true" />
          <p className="text-sm font-bold">لا توجد طلبات بعد</p>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-xl px-5 text-xs font-black shadow-md"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
          >
            ابدأ التسوق
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((o) => (
            <li key={o.id}>
              <Link
                href={`/account/orders/${encodeURIComponent(o.code)}`}
                className="flex items-center justify-between gap-4 rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-black" dir="ltr">
                    {o.code}
                  </p>
                  <p className="mt-1 text-[11px] opacity-60">
                    {new Date(o.createdAt).toLocaleString("ar-EG")}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold",
                    o.status === "delivered" && "text-emerald-600"
                  )}
                  style={{
                    background:
                      o.status === "delivered"
                        ? "color-mix(in srgb, #16a34a 12%, transparent)"
                        : "color-mix(in srgb, var(--primary) 10%, transparent)",
                    color: o.status === "delivered" ? undefined : "var(--primary)",
                  }}
                >
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
                <span className="shrink-0 font-mono text-sm font-black">
                  {formatEgp(o.total)}
                </span>
                <ArrowLeft className="size-4 shrink-0 opacity-40" strokeWidth={SW} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {hasMore ? (
        <div className="flex justify-center pt-4">
          <Link
            href={`?page=${page + 1}`}
            className="inline-flex h-11 items-center rounded-xl border px-5 text-xs font-bold"
            style={{ borderColor: "var(--border)" }}
          >
            الصفحة التالية
          </Link>
        </div>
      ) : null}
    </div>
  );
}