// email-templates/WeeklySummaryEmail.tsx — ملخص أسبوعي للتاجر.
import {
  EmailLayout, EmailHeading, EmailParagraph, EmailButton,
  EmailDivider, EmailInfoBox,
} from "./_layout";

export function WeeklySummaryEmail({
  merchantName, storeName, weekLabel,
  ordersCount, revenueEgp, visitorsCount, conversionRate,
  topProduct, dashboardUrl, logoUrl, revenueDelta,
}: {
  merchantName: string;
  storeName: string;
  weekLabel: string;
  ordersCount: number;
  revenueEgp: number;
  visitorsCount: number;
  conversionRate: number;
  topProduct?: string;
  dashboardUrl: string;
  logoUrl?: string;
  revenueDelta?: number;
}) {
  return (
    <EmailLayout
      brand={{ storeName: "Colapia", logoUrl, primaryColor: "#0f766e" }}
      preheader={`${storeName} — ملخصك الأسبوعي: ${ordersCount} طلب و ${revenueEgp.toLocaleString("en-US")} ج`}
      footerNote={`ملخص أسبوعي لمتجر ${storeName} — إشعار من Colapia.`}
    >
      <EmailHeading>ملخص {storeName} الأسبوعي</EmailHeading>

      <EmailParagraph>
        {merchantName}، إليك ملخص أداء متجرك خلال {weekLabel}:
      </EmailParagraph>

      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}
        style={{ marginTop: "16px", border: "1px solid #eef1f7", borderRadius: "14px", overflow: "hidden" }}>
        <tbody>
          <StatRow label="الطلبات" value={ordersCount.toLocaleString("en-US")} />
          <StatRow
            label="الإيرادات"
            value={`${revenueEgp.toLocaleString("en-US")} ج`}
            delta={revenueDelta}
          />
          <StatRow label="زيارات المتجر" value={visitorsCount.toLocaleString("en-US")} />
          <StatRow label="معدل التحويل" value={`${conversionRate.toFixed(1)}%`} />
        </tbody>
      </table>

      {topProduct ? (
        <EmailInfoBox tone="info">
          <strong>الأكثر مبيعاً هذا الأسبوع:</strong> {topProduct}
        </EmailInfoBox>
      ) : null}

      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        <EmailButton href={dashboardUrl} primaryColor="#0f766e">
          افتح الداشبورد للتفاصيل
        </EmailButton>
      </div>

      <EmailDivider />

      <EmailParagraph>
        <strong>نصيحة الأسبوع:</strong> شارك المنتج الأكثر مبيعاً على
        فيسبوك وإنستجرام بستوري جديد — عادةً بيجيب 10-20% زيادة في الزيارات.
      </EmailParagraph>
    </EmailLayout>
  );
}

function StatRow({
  label, value, delta,
}: { label: string; value: string; delta?: number }) {
  return (
    <tr>
      <td style={{
        padding: "14px 16px", borderBottom: "1px solid #eef1f7",
        fontSize: "13.5px", color: "#64748b", width: "50%",
      }}>
        {label}
      </td>
      <td style={{
        padding: "14px 16px", borderBottom: "1px solid #eef1f7",
        fontSize: "16px", fontWeight: 900, color: "#0b0f1f",
        textAlign: "left",
        fontFamily: "'SF Mono', 'Menlo', monospace", direction: "ltr",
      }}>
        {value}
        {delta !== undefined && delta !== 0 ? (
          <span style={{
            marginInlineStart: "8px", fontSize: "12px", fontWeight: 800,
            color: delta > 0 ? "#059669" : "#dc2626",
          }}>
            {delta > 0 ? "+" : ""}{delta}%
          </span>
        ) : null}
      </td>
    </tr>
  );
}