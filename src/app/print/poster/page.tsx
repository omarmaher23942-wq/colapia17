// /print/poster — ملصق QR بمقاس A4 لطباعته في المحل أو وضعه مع الطلبات: اسم المتجر وشعاره وجملته ورمز QR لرابطه
// وحقائقه الصحيحة (الدفع والشحن والسياسات كما هي). خارج تخطيط اللوحة ليُطبع نظيفاً.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getMerchantSession } from "@/server/auth";
import { requireStoreArea } from "@/server/merchant-guard";
import { readBlueprintFresh } from "@/lib/tenant";
import { getStoreFacts } from "@/server/repos/facts";
import { publicStoreUrl } from "@/lib/utils";
import { PrintNow } from "./PrintNow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ملصق QR", robots: { index: false, follow: false } };

export default async function PosterPage() {
  const session = await getMerchantSession();
  if (!session?.store) redirect("/login?redirect=/print/poster");
  await requireStoreArea("discounts");
  const store = session.store;
  const bp = await readBlueprintFresh(store.id);
  const facts = bp ? (await getStoreFacts(store.id, bp)).slice(0, 4) : [];
  const url = publicStoreUrl(store);
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 900 });
  const color = bp?.theme.palette.primary ?? "#111827";
  const name = bp?.brand.name ?? store.name;

  return (
    <main dir="rtl" className="poster">
      <style>{`
        @page { size: A4; margin: 0; }
        body { margin: 0; background: #f3f4f6; }
        .poster { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 22mm 18mm; box-sizing: border-box; font-family: system-ui, sans-serif; color: #111827; text-align: center; }
        .poster h1 { font-size: 34pt; margin: 6mm 0 2mm; color: ${color}; }
        .poster .tag { font-size: 15pt; color: #4b5563; margin: 0; }
        .poster .qr { width: 110mm; height: 110mm; border: 3mm solid ${color}; border-radius: 8mm; padding: 4mm; }
        .poster .cta { font-size: 24pt; font-weight: 800; margin: 6mm 0 2mm; }
        .poster .url { font-size: 15pt; direction: ltr; color: #374151; }
        .poster ul { list-style: none; padding: 0; margin: 4mm 0 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 3mm 8mm; font-size: 13pt; }
        .poster li::before { content: "✓ "; color: ${color}; font-weight: 800; }
        .bar { position: fixed; top: 12px; left: 12px; display: flex; gap: 8px; }
        .bar button { font: inherit; padding: 8px 14px; border-radius: 10px; border: 1px solid #d1d5db; background: #fff; cursor: pointer; }
        @media print { .bar { display: none; } body { background: #fff; } }
      `}</style>
      <PrintNow />
      <header>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {bp?.brand.logo?.url ? <img src={bp.brand.logo.url} alt="" style={{ maxHeight: "28mm", maxWidth: "70mm", objectFit: "contain" }} /> : null}
        <h1>{name}</h1>
        {bp?.brand.tagline ? <p className="tag">{bp.brand.tagline}</p> : null}
      </header>
      <section>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="qr" src={qr} alt={`رمز QR لمتجر ${name}`} />
        <p className="cta">امسح الكود واطلب أونلاين</p>
        <p className="url">{url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</p>
      </section>
      <ul>
        {facts.map((f) => (
          <li key={f.key}>{f.title}</li>
        ))}
      </ul>
    </main>
  );
}
