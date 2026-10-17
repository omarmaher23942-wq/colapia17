import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { CheckCircle2, FileText, Gift, Search } from "lucide-react";
import { requireStore, getBlueprint } from "@/lib/tenant";
import { getOrderByCode, getOrderByCodeAndPhone } from "@/server/repos/orders";
import { getTenantDb } from "@/db/tenant";
import { returnRequests } from "@/db/schema";
import { hasOrderAccess, orderLinkToken } from "@/lib/order-access";
import { formatEgp } from "@/lib/money";
import { governorateName } from "@/lib/egypt";
import { prettyPhone } from "@/lib/phone";
import { TransferProof } from "@/components/storefront/TransferProof";
import { OrderActions } from "@/components/storefront/OrderActions";
import { OrderTimeline } from "@/components/storefront/OrderTimeline";
import { BrandIcon } from "@/components/storefront/brand-icons";
import { waLink } from "@/lib/whatsapp";
import { customerOrderWhatsApp } from "@/lib/order-messages";
import { canRequestCancel, returnKindsAllowed, returnWindow } from "@/lib/order-requests";
import { publicStoreUrl } from "@/lib/utils";

const SW = 1.75;
/** يقبل رقم الطلب بالبادئة الحالية (#1042) والأكواد القديمة (CLP-XXXXX). */
const CODE_RE = /^[A-Z0-9\-_%#\[\]]{2,32}$/i;

export const metadata: Metadata = { title: "تفاصيل الطلب", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ store: string; code: string }>; searchParams: Promise<{ phone?: string | string[] }> };

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { store: sub, code: rawCode } = await params;
  const { phone } = await searchParams;
  const code = safeDecode(rawCode).trim().toUpperCase();
  if (!CODE_RE.test(code)) notFound();

  const store = await requireStore(sub);
  const legacyPhone = typeof phone === "string" && phone ? phone : undefined;
  const [bp, found] = await Promise.all([getBlueprint(store.id), getOrderByCode(store.id, code)]);
  // الوصول: cookie الطلب بعد الشراء، أو نفس الجهاز الذي طلب منه، أو رقم الموبايل من صفحة التتبع.
  const cookieAccess = found ? await hasOrderAccess(store.id, code, found.visitorId) : false;
  const o = cookieAccess ? found : legacyPhone ? await getOrderByCodeAndPhone(store.id, code, legacyPhone) : null;

  if (!o) {
    return (
      <div className="container-x max-w-md py-16 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary" aria-hidden="true">
          <Search strokeWidth={SW} className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl">الطلب يُفتح من صفحة «طلباتي»</h1>
        <p className="mt-2 text-muted-foreground">لحماية البيانات، نطلب رقم الطلب ورقم الموبايل المستخدم فيه، أو فتح «رابط طلباتي» المرسل بعد الشراء.</p>
        <Link href={`/track?code=${encodeURIComponent(code)}`} className="s-btn mt-6">
          تتبع الطلب
        </Link>
      </div>
    );
  }

  const db = await getTenantDb(store.id);
  const openReturn = await db
    .select({ id: returnRequests.id })
    .from(returnRequests)
    .where(and(eq(returnRequests.storeId, store.id), eq(returnRequests.orderId, o.id), inArray(returnRequests.status, ["new", "approved", "received"])))
    .limit(1);

  const transfer = o.paymentMethod !== "cod";
  const closed = o.status === "cancelled" || o.status === "returned";
  // رابط طلباتي الموقّع: يفتح الطلب على أي جهاز ويربطه به.
  const link = publicStoreUrl(store, `/order/${encodeURIComponent(o.code)}/open?k=${orderLinkToken(store.id, o.id)}`);
  const waHref = waLink(bp.channels.whatsappNumber, customerOrderWhatsApp(o, bp.brand.name || store.name, formatEgp, link));
  const target = o.paymentMethod === "vodafone_cash" ? bp.payments.vodafoneCash.number : (bp.payments.instapay.address ?? bp.payments.instapay.number);
  const holder = o.paymentMethod === "vodafone_cash" ? bp.payments.vodafoneCash.holderName : bp.payments.instapay.holderName;
  const needsProof = transfer && bp.payments.requireTransferProof && !closed && o.paymentStatus !== "confirmed" && o.paymentStatus !== "refunded" && (!o.transferScreenshotUrl || o.paymentStatus === "rejected");
  const proofPending = transfer && !closed && o.paymentStatus === "under_review" && Boolean(o.transferScreenshotUrl);
  const kinds = returnKindsAllowed(bp.returns);
  const win = returnWindow(o, bp.returns.windowDays);
  const hidePrices = Boolean(o.gift?.hidePrices);

  return (
    <div className="container-x max-w-2xl py-10 text-center sm:py-12">
      <CheckCircle2 strokeWidth={SW} className="mx-auto size-14 text-success" aria-hidden="true" />
      <h1 className="mt-4 text-2xl sm:text-3xl">{closed ? "تفاصيل الطلب" : "تم استلام الطلب"}</h1>
      <p className="mt-2 text-muted-foreground">رقم الطلب</p>
      <p className="text-3xl font-black tracking-widest text-primary" dir="ltr">{o.code}</p>
      {o.isTest ? <p className="mx-auto mt-2 w-fit rounded-full bg-muted px-3 py-1 text-xs font-bold">طلب تجريبي من معاينة المالك</p> : null}
      <p className="mt-2 text-sm text-muted-foreground">
        الطلب محفوظ في «طلباتي» على هذا الجهاز. سنتواصل على <span dir="ltr">{prettyPhone(o.customerPhone)}</span> للتأكيد.
      </p>

      {waHref ? (
        <div className="surface mt-6 p-5">
          <p className="text-sm font-semibold">إرسال رقم الطلب للمتجر على واتساب</p>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">رسالة جاهزة فيها رقم الطلب وتفاصيله ورابط «طلباتي»، تبقى في المحادثة مرجعاً عند تغيير الجهاز.</p>
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex h-12 items-center gap-2 rounded-xl bg-[#25D366] px-5 font-bold text-white hover:brightness-95">
            <BrandIcon brand="whatsapp" className="size-5" /> إرسال الرسالة على واتساب
          </a>
        </div>
      ) : null}

      <div className="surface mt-8 p-5 text-start sm:p-6">
        <h2 className="mb-4 text-lg">حالة الطلب</h2>
        <OrderTimeline status={o.status} history={o.statusHistory} createdAt={o.createdAt} courier={o.courierName} tracking={o.trackingNumber} />
        {o.cancelRequestedAt && !closed ? <p className="mt-2 rounded-xl bg-muted p-3 text-sm font-bold">تم إرسال طلب الإلغاء، وسيتواصل معكم المتجر.</p> : null}
      </div>

      {transfer && !closed && o.paymentStatus !== "confirmed" ? (
        <div className="surface mt-8 p-5 text-start sm:p-6">
          <h2 className="text-lg">إكمال الدفع بالتحويل</h2>
          <p className="mt-2 leading-8">
            حوّلوا <b className="text-primary" dir="ltr">{formatEgp(o.totalPiasters)}</b> عبر {o.paymentMethod === "vodafone_cash" ? "فودافون كاش" : "إنستاباي"}
            {target ? (
              <>
                : <b dir="ltr" className="select-all">{target}</b>
                {holder ? <> (باسم {holder})</> : null}
              </>
            ) : (
              <>. تواصلوا مع المتجر للحصول على بيانات التحويل.</>
            )}
          </p>
          {bp.payments.transferInstructions ? <p className="mt-2 text-sm text-muted-foreground">{bp.payments.transferInstructions}</p> : null}
          {proofPending ? <p role="status" className="mt-4 rounded-xl bg-muted p-3 text-sm font-bold">استلمنا إيصال التحويل وهو قيد المراجعة.</p> : null}
          {o.paymentStatus === "rejected" ? <p role="alert" className="mt-4 text-sm font-bold text-danger">تعذّر قبول الإيصال السابق، يرجى رفع صورة أوضح.</p> : null}
          {needsProof ? <TransferProof subdomain={store.subdomain} code={o.code} accessPhone={cookieAccess ? undefined : legacyPhone} /> : null}
        </div>
      ) : null}

      <div className="surface mt-8 p-5 text-start sm:p-6">
        <h2 className="mb-3 text-lg">تفاصيل الطلب</h2>
        {o.gift ? (
          <p className="mb-3 flex items-start gap-2 rounded-xl bg-muted p-3 text-sm">
            <Gift strokeWidth={SW} className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>طلب هدية{o.gift.wrap ? " بتغليف" : ""}{o.gift.message ? <>: «{o.gift.message}»</> : null}</span>
          </p>
        ) : null}
        <ul className="divide-y text-sm">
          {o.items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-2.5">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                {i.imageUrl ? <Image src={i.imageUrl} alt="" fill sizes="56px" className="object-cover" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 font-bold">{i.name}</span>
                <span className="block text-xs text-muted-foreground">{i.variantLabel ? `${i.variantLabel} · ` : ""}الكمية {i.quantity}</span>
              </span>
              {hidePrices ? null : <span className="shrink-0 font-mono text-xs font-bold tabular-nums">{i.unitPiasters === 0 ? "مجاناً" : formatEgp(i.totalPiasters)}</span>}
            </li>
          ))}
        </ul>
        {hidePrices ? null : (
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <p className="flex justify-between"><span>المجموع</span><span>{formatEgp(o.subtotalPiasters)}</span></p>
            {o.discountPiasters > 0 && <p className="flex justify-between text-success"><span>خصم{o.discountCode ? ` (${o.discountCode})` : ""}</span><span>- {formatEgp(o.discountPiasters)}</span></p>}
            <p className="flex justify-between"><span>الشحن إلى {governorateName(o.governorate)}</span><span>{o.shippingPiasters ? formatEgp(o.shippingPiasters) : "مجاني"}</span></p>
            {o.codFeePiasters > 0 && <p className="flex justify-between"><span>رسوم الدفع عند الاستلام</span><span>{formatEgp(o.codFeePiasters)}</span></p>}
            <p className="flex justify-between text-lg font-black"><span>الإجمالي</span><span>{formatEgp(o.totalPiasters)}</span></p>
          </div>
        )}
        <Link href={`/order/${encodeURIComponent(o.code)}/invoice`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold underline underline-offset-4">
          <FileText strokeWidth={SW} className="size-4" aria-hidden="true" /> الفاتورة (طباعة أو حفظ PDF)
        </Link>
      </div>

      <div className="mt-8">
        <OrderActions
          subdomain={store.subdomain}
          code={o.code}
          accessPhone={cookieAccess ? undefined : legacyPhone}
          canCancel={canRequestCancel(o)}
          cancelRequested={Boolean(o.cancelRequestedAt)}
          returnKinds={win.open ? kinds : []}
          returnDaysLeft={win.daysLeft}
          returnOpen={openReturn.length > 0}
          items={o.items.map((i) => ({ id: i.id, name: i.name, variantLabel: i.variantLabel, quantity: i.quantity, unitPiasters: i.unitPiasters }))}
          link={link}
        />
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/track" className="s-btn">طلباتي</Link>
        <Link href="/" className="s-btn-ghost">متابعة التسوق</Link>
      </div>
    </div>
  );
}
