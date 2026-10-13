// /confirm — «أكّد طلبك»: يفتحه العميل من رابط واتساب الموقّع (?o=رقم&t=رمز) فيرى ملخص طلبه وعنوانه ويؤكده أو يلغيه بضغطة.
// الرمز مربوط بالطلب نفسه (HMAC)، فرقم الطلب وحده لا يكشف بياناته. صفحة خاصة لا تُفهرس.
import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { Lock, PackageCheck } from "lucide-react";
import { requireStore } from "@/lib/tenant";
import { getTenantDb } from "@/db/tenant";
import { orderItems, orders } from "@/db/schema";
import { validConfirmToken } from "@/lib/order-access";
import { formatEgp } from "@/lib/money";
import { governorateName } from "@/lib/egypt";
import { paymentMethodLabel } from "@/lib/order-status";
import { amountToCollect } from "@/lib/order-messages";
import { OrderConfirmCard } from "@/components/storefront/OrderConfirmCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "أكّد طلبك", robots: { index: false, follow: false } };

const SW = 1.75;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function ConfirmPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { store: sub } = await params;
  const sp = await searchParams;
  const store = await requireStore(sub);
  const code = one(sp.o).trim().toUpperCase().slice(0, 20);
  const token = one(sp.t).slice(0, 64);
  const db = await getTenantDb(store.id);
  const [o] = code ? await db.select().from(orders).where(and(eq(orders.storeId, store.id), eq(orders.code, code))).limit(1) : [];

  if (!o || !validConfirmToken(store.id, o.id, token)) {
    return (
      <Shell>
        <Lock strokeWidth={SW} className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-3 text-2xl">الرابط غير صالح</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">رابط التأكيد يُفتح كما وصل في رسالة المتجر، وكل طلباتك في «طلباتي».</p>
        <Link href="/track" className="btn-brand mt-6">
          طلباتي
        </Link>
      </Shell>
    );
  }

  const items = await db
    .select({ name: orderItems.name, variantLabel: orderItems.variantLabel, quantity: orderItems.quantity, totalPiasters: orderItems.totalPiasters })
    .from(orderItems)
    .where(and(eq(orderItems.storeId, store.id), eq(orderItems.orderId, o.id)));
  // «طلباتي» يفتح الطلب من نفس الجهاز، أو بالرقم والموبايل من أي جهاز.
  const orderHref = `/track?code=${encodeURIComponent(o.code)}`;
  const collect = amountToCollect(o);
  const already = o.statusHistory.some((h) => h.note?.startsWith("أكّده العميل"));

  return (
    <div className="container-x max-w-md py-10">
      <p className="text-sm text-muted-foreground">طلب {o.code}</p>
      <h1 className="mt-1 text-2xl">راجع طلبك وأكّده</h1>

      <ul className="mt-5 divide-y divide-border rounded-2xl border border-border">
        {items.map((i, k) => (
          <li key={k} className="flex items-start justify-between gap-3 p-3 text-sm">
            <span>
              <b>{i.name}</b>
              {i.variantLabel ? <span className="block text-muted-foreground">{i.variantLabel}</span> : null}
              <span className="text-muted-foreground"> × {i.quantity}</span>
            </span>
            <span className="shrink-0 font-bold tabular-nums">{formatEgp(i.totalPiasters)}</span>
          </li>
        ))}
        <li className="flex justify-between p-3 text-sm">
          <span className="font-bold">الإجمالي</span>
          <span className="font-bold tabular-nums">{formatEgp(o.totalPiasters)}</span>
        </li>
      </ul>

      <dl className="mt-4 space-y-2 rounded-2xl border border-border p-4 text-sm">
        <div>
          <dt className="text-muted-foreground">التوصيل إلى</dt>
          <dd className="mt-0.5 font-bold">
            {o.customerName} · <span dir="ltr">{o.customerPhone}</span>
          </dd>
          <dd className="mt-0.5">{[o.address, o.city, governorateName(o.governorate)].filter(Boolean).join("، ")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">الدفع</dt>
          <dd className="mt-0.5">
            {paymentMethodLabel(o.paymentMethod)}
            {collect > 0 ? ` · تدفع ${formatEgp(collect)} عند الاستلام` : ""}
          </dd>
        </div>
      </dl>

      {o.status === "new" ? (
        <OrderConfirmCard subdomain={store.subdomain} code={o.code} token={token} orderHref={orderHref} />
      ) : (
        <div className="mt-6 rounded-2xl border border-border p-5 text-center">
          <PackageCheck strokeWidth={SW} className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-bold">
            {o.status === "cancelled" ? "هذا الطلب ملغي" : already || o.status === "confirmed" ? "طلبك مؤكد" : "المتجر يجهّز طلبك بالفعل"}
          </p>
          <Link href={orderHref} className="btn-brand mt-4">
            حالة الطلب
          </Link>
        </div>
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="container-x max-w-md py-16 text-center">{children}</div>;
}
