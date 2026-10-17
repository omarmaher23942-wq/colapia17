// /print/labels?ids=a,b — ملصقات الشحن (بوليصة A6 لكل طلب): المرسل والمستلم والعنوان والمحتوى ومبلغ التحصيل ورمز QR لتتبع الطلب.
// ملصق «بطاقة التعبئة» (?mode=pack) يضيف قائمة القطع ورسالة الهدية دون أسعار. خارج تخطيط اللوحة ليُطبع نظيفاً.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import QRCode from "qrcode";
import { getMerchantSession } from "@/server/auth";
import { requireStoreArea } from "@/server/merchant-guard";
import { getTenantDb } from "@/db/tenant";
import { orderItems, orders } from "@/db/schema";
import { governorateName } from "@/lib/egypt";
import { codAmountEgp } from "@/lib/courier-export";
import { storeUrl } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { PrintBar } from "./PrintBar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ملصقات الشحن", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ ids?: string; mode?: string }> }) {
  const sp = await searchParams;
  const ids = (sp.ids ?? "").split(",").map((s) => s.trim()).filter((s) => UUID.test(s)).slice(0, 100);
  const session = await getMerchantSession();
  if (!session?.store) redirect(`/login?redirect=${encodeURIComponent(`/print/labels?ids=${ids.join(",")}`)}`);
  await requireStoreArea("orders");
  if (!ids.length) redirect("/dashboard/orders/ship");
  const store = session.store;
  const db = await getTenantDb(store.id);
  const [rows, items] = await Promise.all([
    db.select().from(orders).where(and(eq(orders.storeId, store.id), inArray(orders.id, ids))),
    db.select().from(orderItems).where(and(eq(orderItems.storeId, store.id), inArray(orderItems.orderId, ids))),
  ]);
  const ordered = ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is (typeof rows)[number] => Boolean(r));
  const qrs = await Promise.all(ordered.map((o) => QRCode.toDataURL(storeUrl(store.subdomain, `/track?code=${encodeURIComponent(o.code)}`), { margin: 0, width: 220 }).catch(() => "")));
  const pack = sp.mode === "pack";

  return (
    <main dir="rtl" className="labels">
      <style>{`
        @page { size: A6; margin: 0 }
        html, body { background: #e5e7eb; margin: 0; font-family: system-ui, "Segoe UI", Tahoma, sans-serif; }
        .bar { position: sticky; top: 0; display: flex; gap: 8px; padding: 10px; background: #111827; z-index: 2 }
        .bar button { min-height: 40px; padding: 0 16px; border-radius: 10px; border: 0; font-weight: 700; cursor: pointer }
        .sheet { box-sizing: border-box; width: 105mm; min-height: 148mm; margin: 12px auto; padding: 6mm; background: #fff; color: #000; page-break-after: always; break-after: page; display: flex; flex-direction: column; gap: 3mm; font-size: 11px; line-height: 1.6 }
        .sheet h2 { margin: 0; font-size: 15px }
        .row { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start }
        .box { border: 1.5px solid #000; border-radius: 6px; padding: 3mm }
        .big { font-size: 22px; font-weight: 900 }
        .lbl { font-weight: 700; color: #444 }
        ul { margin: 0; padding-inline-start: 16px }
        @media print { html, body { background: #fff } .bar { display: none } .sheet { margin: 0; width: 105mm; height: 148mm; min-height: 0; box-shadow: none } }
      `}</style>
      <PrintBar />
      {ordered.map((o, i) => {
        const lines = items.filter((it) => it.orderId === o.id);
        const collect = codAmountEgp({ paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus, totalPiasters: o.totalPiasters, paidPiasters: o.paidPiasters });
        return (
          <section key={o.id} className="sheet">
            <div className="row">
              <div>
                <h2>{store.name}</h2>
                <span className="lbl">طلب</span> <b dir="ltr">{o.code}</b>
              </div>
              {qrs[i] ? <img src={qrs[i]} alt="" width={84} height={84} /> : null}
            </div>
            <div className="box">
              <div className="lbl">إلى</div>
              <div style={{ fontSize: 15, fontWeight: 900 }}>{o.customerName}</div>
              <div dir="ltr" style={{ textAlign: "right", fontWeight: 800, fontSize: 14 }}>
                {[o.customerPhone, o.customerAltPhone].filter(Boolean).join(" / ")}
              </div>
              <div>
                {governorateName(o.governorate)}
                {o.city ? `، ${o.city}` : ""}، {o.address}
                {o.landmark ? ` (${o.landmark})` : ""}
              </div>
            </div>
            <div className="box" style={{ textAlign: "center" }}>
              <div className="lbl">{collect > 0 ? "المطلوب تحصيله" : "لا تحصيل (مدفوع مسبقاً)"}</div>
              {collect > 0 ? <div className="big">{formatEgp(Math.round(collect * 100))}</div> : null}
            </div>
            {o.customerNotes ? (
              <div>
                <span className="lbl">ملاحظة العميل: </span>
                {o.customerNotes}
              </div>
            ) : null}
            <div>
              <span className="lbl">المحتوى: </span>
              {pack ? (
                <ul>
                  {lines.map((l) => (
                    <li key={l.id}>
                      {l.name}
                      {l.variantLabel ? ` (${l.variantLabel})` : ""} × {l.quantity}
                    </li>
                  ))}
                </ul>
              ) : (
                `${lines.reduce((n, l) => n + l.quantity, 0)} قطعة`
              )}
            </div>
            {o.gift?.wrap ? (
              <div className="box">
                <b>تغليف هدية</b>
                {o.gift.message ? <div>{o.gift.message}</div> : null}
              </div>
            ) : null}
            <div className="row" style={{ marginTop: "auto" }}>
              <span>{[o.courierName, o.trackingNumber].filter(Boolean).join(" · ")}</span>
              <span style={{ color: "#555" }}>{new Date(o.createdAt).toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "long", timeZone: "Africa/Cairo" })}</span>
            </div>
          </section>
        );
      })}
    </main>
  );
}
