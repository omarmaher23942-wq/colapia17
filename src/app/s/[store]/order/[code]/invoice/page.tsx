// فاتورة العميل: صفحة مطبوعة بسيطة (طباعة أو حفظ PDF من المتصفح) لصاحب الطلب فقط (جهازه أو رابط طلباتي). تحترم «إخفاء الأسعار» في طلب الهدية.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStore, getBlueprint } from "@/lib/tenant";
import { getOrderByCode } from "@/server/repos/orders";
import { hasOrderAccess } from "@/lib/order-access";
import { formatEgp } from "@/lib/money";
import { governorateName } from "@/lib/egypt";
import { PrintInvoiceButton } from "./PrintInvoiceButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الفاتورة", robots: { index: false, follow: false } };

export default async function ShopperInvoice({ params }: { params: Promise<{ store: string; code: string }> }) {
  const { store: sub, code: raw } = await params;
  let code = raw;
  try {
    code = decodeURIComponent(raw);
  } catch {
    /* كما هو */
  }
  code = code.trim().toUpperCase();
  const store = await requireStore(sub);
  const [bp, o] = await Promise.all([getBlueprint(store.id), getOrderByCode(store.id, code)]);
  if (!o) notFound();
  if (!(await hasOrderAccess(store.id, o.code, o.visitorId))) {
    return (
      <div className="container-x max-w-md py-16 text-center">
        <h1 className="text-2xl">الفاتورة تُفتح من الجهاز الذي طُلب منه</h1>
        <p className="mt-2 text-sm text-muted-foreground">افتحوا «رابط طلباتي» المرسل بعد الشراء ثم اطلبوا الفاتورة.</p>
        <Link href="/track" className="s-btn mt-6">طلباتي</Link>
      </div>
    );
  }
  const hide = Boolean(o.gift?.hidePrices);
  const date = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Cairo" }).format(o.createdAt);
  return (
    <div className="container-x max-w-2xl py-8 print:py-0">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/order/${encodeURIComponent(o.code)}`} className="text-sm font-bold underline underline-offset-4">رجوع للطلب</Link>
        <PrintInvoiceButton />
      </div>
      <article className="surface space-y-4 p-6 print:border-0 print:p-0 print:shadow-none" aria-label={`فاتورة الطلب ${o.code}`}>
        <header className="flex items-start justify-between gap-4 border-b pb-3">
          <div>
            <h1 className="text-xl font-black">{bp.brand.name}</h1>
            <p className="text-xs text-muted-foreground">فاتورة</p>
          </div>
          <div className="text-end text-sm">
            <p dir="ltr" className="font-mono font-black">{o.code}</p>
            <p className="text-muted-foreground">{date}</p>
          </div>
        </header>
        <section className="text-sm leading-7">
          <p className="font-black">{o.customerName}</p>
          <p dir="ltr" className="text-end font-mono">{o.customerPhone}</p>
          <p>{[governorateName(o.governorate), o.city, o.address, o.landmark].filter(Boolean).join("، ")}</p>
          {o.gift?.message ? <p className="mt-1 text-muted-foreground">رسالة الهدية: {o.gift.message}</p> : null}
        </section>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-start">
              <th className="py-2 text-start">المنتج</th>
              <th className="py-2 text-center">الكمية</th>
              {hide ? null : <th className="py-2 text-end">الإجمالي</th>}
            </tr>
          </thead>
          <tbody>
            {o.items.map((i) => (
              <tr key={i.id} className="border-b">
                <td className="py-2">
                  <b>{i.name}</b>
                  {i.variantLabel ? <span className="block text-xs text-muted-foreground">{i.variantLabel}</span> : null}
                </td>
                <td className="py-2 text-center">{i.quantity}</td>
                {hide ? null : <td className="py-2 text-end font-mono">{i.unitPiasters === 0 ? "مجاناً" : formatEgp(i.totalPiasters)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {hide ? null : (
          <dl className="ms-auto w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><dt>المجموع</dt><dd>{formatEgp(o.subtotalPiasters)}</dd></div>
            {o.discountPiasters > 0 ? <div className="flex justify-between"><dt>خصم</dt><dd>- {formatEgp(o.discountPiasters)}</dd></div> : null}
            <div className="flex justify-between"><dt>الشحن</dt><dd>{o.shippingPiasters ? formatEgp(o.shippingPiasters) : "مجاني"}</dd></div>
            {o.codFeePiasters > 0 ? <div className="flex justify-between"><dt>رسوم الدفع عند الاستلام</dt><dd>{formatEgp(o.codFeePiasters)}</dd></div> : null}
            <div className="flex justify-between border-t pt-1 text-base font-black"><dt>الإجمالي</dt><dd>{formatEgp(o.totalPiasters)}</dd></div>
          </dl>
        )}
        {bp.invoice.footerNote ? <p className="border-t pt-3 text-center text-xs text-muted-foreground">{bp.invoice.footerNote}</p> : null}
      </article>
    </div>
  );
}
