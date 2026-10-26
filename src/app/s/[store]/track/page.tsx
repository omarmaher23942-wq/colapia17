import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, PackageCheck, Smartphone, Star } from "lucide-react";
import { requireStore } from "@/lib/tenant";
import { getOrderByCode, getOrderByCodeAndPhone, listDeviceOrders } from "@/server/repos/orders";
import { currentDeviceId, hasOrderAccess } from "@/lib/order-access";
import { formatEgp } from "@/lib/money";
import { OrderExtras } from "@/components/storefront/OrderExtras";
import { getBlueprint } from "@/lib/tenant";
import { OrderTimeline } from "@/components/storefront/OrderTimeline";
import { AutoRefresh } from "@/components/storefront/AutoRefresh";
import { allow, clientIp } from "@/lib/ratelimit";
import { trackOrderAction } from "@/server/actions/track";
import { cn } from "@/lib/utils";

const SW = 1.75;
const CODE_RE = /^[A-Z0-9#-]{2,20}$/;
const STEPS = [
  ["new", "تم الاستلام"],
  ["confirmed", "تم التأكيد"],
  ["preparing", "جاري التجهيز"],
  ["shipped", "مع شركة الشحن"],
  ["delivered", "تم التوصيل"],
] as const;

export const metadata: Metadata = { title: "طلباتي", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = Object.fromEntries([...STEPS, ["cancelled", "ملغي"], ["returned", "مرتجع"]]);
const ACTIVE = new Set(["new", "confirmed", "preparing", "shipped"]);

type SP = { code?: string | string[]; phone?: string | string[]; e?: string | string[] };
type Props = { params: Promise<{ store: string }>; searchParams: Promise<SP> };
type Order = Awaited<ReturnType<typeof getOrderByCode>>;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const INPUT = "rounded-lg border bg-background px-3 py-3 outline-none focus:ring-2 ring-primary/30";

export default async function TrackPage({ params, searchParams }: Props) {
  const { store: sub } = await params;
  const sp = await searchParams;
  const store = await requireStore(sub);

  const code = one(sp.code).trim().toUpperCase().slice(0, 20);
  const legacyPhone = one(sp.phone);
  let limited = one(sp.e) === "limited";
  let missing = one(sp.e) === "notfound";
  let o: Order = null;

  const bp = await getBlueprint(store.id);
  const device = await currentDeviceId();
  const mine = device ? await listDeviceOrders(store.id, device) : [];

  if (CODE_RE.test(code)) {
    const found = await getOrderByCode(store.id, code);
    if (found && (await hasOrderAccess(store.id, code, found.visitorId))) {
      o = found;
    } else if (legacyPhone) {
      // روابط قديمة فيها الموبايل: مدعومة مع حد المحاولات
      if (await allow("track", clientIp(await headers()))) {
        o = await getOrderByCodeAndPhone(store.id, code, legacyPhone);
        if (!o) missing = true;
      } else {
        limited = true;
      }
    }
  }


  return (
    <div className="container-x max-w-xl py-12">
      {mine.some((m) => ACTIVE.has(m.status)) || (o && ACTIVE.has(o.status)) ? <AutoRefresh everyMs={30_000} /> : null}
      <h1 className="mb-2 text-3xl">{mine.length ? "طلباتي" : "تتبع طلبك"}</h1>
      {mine.length ? (
        <p className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Smartphone strokeWidth={SW} className="size-4" aria-hidden="true" /> محفوظة على هذا الجهاز، فلا تحتاج لحفظ رقم الطلب.
        </p>
      ) : null}

      {mine.length ? (
        <ul className="mb-8 space-y-2.5">
          {mine.map((m) => {
            const active = ACTIVE.has(m.status);
            const selected = o?.code === m.code;
            return (
              <li key={m.id}>
                <Link
                  href={`/track?code=${encodeURIComponent(m.code)}`}
                  scroll={false}
                  aria-current={selected ? "true" : undefined}
                  className={cn("surface flex items-center gap-3 p-4 transition-shadow hover:shadow-md", selected && "ring-2 ring-primary/40")}
                >
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                    <PackageCheck strokeWidth={SW} className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <b dir="ltr" className="font-mono">{m.code}</b>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                        {LABEL[m.status] ?? m.status}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {m.createdAt.toLocaleDateString("ar-EG", { day: "numeric", month: "long" })} · {formatEgp(m.total)}
                    </span>
                  </span>
                  <ChevronLeft strokeWidth={SW} className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      {mine.length ? <h2 className="mb-3 text-base font-bold">طلبت من جهاز آخر؟</h2> : null}
      <form action={trackOrderAction.bind(null, store.subdomain)} className="surface grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto]">
        <input name="code" defaultValue={code} placeholder="رقم الطلب (مثال: 1042)" dir="ltr" maxLength={20} className={cn(INPUT, "uppercase")} required />
        <input name="phone" placeholder="رقم الموبايل" inputMode="tel" autoComplete="tel" dir="ltr" maxLength={20} className={INPUT} required />
        <button type="submit" className="btn-brand">تتبع</button>
      </form>

      {limited && <p className="mt-4 text-danger">محاولات كثيرة، يرجى المحاولة بعد دقائق</p>}
      {missing && !limited && !o && <p className="mt-4 text-danger">لا يوجد طلب بهذه البيانات. يرجى التأكد من رقم الطلب والموبايل.</p>}

      {o && (
        <div className="surface mt-6 p-6">
          <p className="text-sm text-muted-foreground">الطلب</p>
          <p className="text-2xl font-black text-primary" dir="ltr">{o.code}</p>

          <div className="mt-5">
            <OrderTimeline status={o.status} history={o.statusHistory} createdAt={o.createdAt} courier={o.courierName} tracking={o.trackingNumber} />
          </div>

          <OrderExtras code={o.code} storeName={bp.brand.name || store.name} whatsapp={bp.channels.whatsappNumber} tracking={o.trackingNumber} />

          <ul className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="منتجات الطلب">
            {o.items.map((it) => (
              <li key={it.id} className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted" title={it.name}>
                {it.imageUrl ? <Image src={it.imageUrl} alt={it.name} fill sizes="56px" className="object-cover" /> : null}
              </li>
            ))}
          </ul>
          <Link href={`/order/${encodeURIComponent(o.code)}`} className="mt-4 inline-flex text-sm font-bold underline underline-offset-4">
            تفاصيل الطلب وخيارات الإلغاء والاستبدال
          </Link>

          {o.status === "delivered" ? (
            <Link href={`/review?o=${encodeURIComponent(o.code)}`} className="btn-brand mt-6 w-full">
              <Star strokeWidth={SW} className="size-4" aria-hidden="true" /> قيّم مشترياتك
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
