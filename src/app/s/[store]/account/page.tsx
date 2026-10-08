// app/s/[store]/account/page.tsx — نظرة عامة لحساب المشتري.
import Link from "next/link";
import { Suspense } from "react";
import {
  Package, Truck, CreditCard, ShoppingBag, ArrowLeft, User, Mail,
} from "lucide-react";
import { requireStore } from "@/lib/tenant";
import { getCustomerSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { orders } from "@/db/schema/commerce";
import { and, desc, eq } from "drizzle-orm";
import { formatEgp } from "@/lib/money";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SW = 1.75;

const STATUS_LABEL: Record<string, string> = {
  new: "جديد",
  confirmed: "مؤكد",
  preparing: "قيد التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
  returned: "مُرتجع",
};

export default async function AccountHomePage({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store: sub } = await params;
  const store = await requireStore(sub);
  const session = await getCustomerSession(store.id);
  if (!session) return null;

  const db = await getTenantDb(store.id);
  const recent = await db
    .select({
      id: orders.id,
      code: orders.code,
      status: orders.status,
      total: orders.totalPiasters,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      and(
        eq(orders.storeId, store.id),
        eq(orders.customerId, session.customerId)
      )
    )
    .orderBy(desc(orders.createdAt))
    .limit(5);

  const customer = session.customer;
  const ordersCount = customer.ordersCount;
  const totalSpent = customer.totalSpentPiasters;

  const stats = [
    { label: "إجمالي الطلبات", value: String(ordersCount), icon: Package },
    {
      label: "إجمالي المشتريات",
      value: formatEgp(totalSpent),
      icon: CreditCard,
    },
    {
      label: "أحدث شحنة",
      value: recent[0] ? STATUS_LABEL[recent[0].status] ?? recent[0].status : "—",
      icon: Truck,
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-black">
          أهلاً، {customer.name}
        </h1>
        <p className="mt-1 text-xs opacity-70">
          هذه نظرة سريعة على حسابك في {store.name}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="rounded-3xl border p-5"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
              }}
            >
              <span
                className="grid size-10 place-items-center rounded-2xl"
                style={{
                  background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                  color: "var(--primary)",
                }}
              >
                <Icon className="size-5" strokeWidth={SW} aria-hidden="true" />
              </span>
              <p className="mt-3 font-mono text-xl font-black tabular-nums">
                {s.value}
              </p>
              <p className="mt-0.5 text-[11px] font-bold opacity-60">
                {s.label}
              </p>
            </div>
          );
        })}
      </section>

      <section
        className="rounded-3xl border p-5"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-base font-black">آخر طلباتك</h2>
          <Link
            href="/account/orders"
            className="inline-flex items-center gap-1 text-[11px] font-bold transition-opacity hover:opacity-80"
            style={{ color: "var(--primary)" }}
          >
            عرض الكل
            <ArrowLeft className="size-3" strokeWidth={SW} aria-hidden="true" />
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <ShoppingBag
              className="size-10 opacity-25"
              strokeWidth={SW}
              aria-hidden="true"
            />
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
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {recent.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/account/orders/${encodeURIComponent(o.code)}`}
                  className="flex items-center justify-between gap-3 py-3 transition-opacity hover:opacity-80"
                >
                  <div className="min-w-0">
                    <p
                      className="font-mono text-xs font-black"
                      dir="ltr"
                    >
                      {o.code}
                    </p>
                    <p className="mt-0.5 text-[11px] opacity-60">
                      {new Date(o.createdAt).toLocaleDateString("ar-EG")}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-md px-2 py-1 text-[11px] font-bold",
                      o.status === "delivered" && "text-emerald-600"
                    )}
                    style={{
                      background:
                        o.status === "delivered"
                          ? "color-mix(in srgb, #16a34a 12%, transparent)"
                          : "color-mix(in srgb, var(--primary) 10%, transparent)",
                      color:
                        o.status === "delivered" ? undefined : "var(--primary)",
                    }}
                  >
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                  <span className="font-mono text-sm font-black">
                    {formatEgp(o.total)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Profile info */}
      <section
        className="rounded-3xl border p-5"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <h2 className="mb-4 font-heading text-base font-black">بياناتي</h2>
        <ul className="space-y-3 text-xs">
          <li className="flex items-center gap-2">
            <User
              className="size-4 shrink-0 opacity-60"
              strokeWidth={SW}
              aria-hidden="true"
            />
            <span className="font-bold">{customer.name}</span>
          </li>
          {customer.email ? (
            <li className="flex items-center gap-2">
              <Mail
                className="size-4 shrink-0 opacity-60"
                strokeWidth={SW}
                aria-hidden="true"
              />
              <span className="font-mono opacity-80" dir="ltr">
                {customer.email}
              </span>
            </li>
          ) : null}
        </ul>
        <Link
          href="/account/profile"
          className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold transition-opacity hover:opacity-80"
          style={{ color: "var(--primary)" }}
        >
          تعديل البيانات
          <ArrowLeft className="size-3" strokeWidth={SW} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}