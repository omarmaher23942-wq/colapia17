// email-templates/PriceDropBackInStockEmail.tsx — تنبيه انخفاض سعر أو توفر.
import {
  EmailLayout, EmailHeading, EmailParagraph, EmailButton,
  EmailDivider, EmailInfoBox,
} from "./_layout";

export function PriceDropBackInStockEmail({
  customerName, storeName, storeSubdomain,
  kind, productName, productUrl, productImageUrl,
  oldPrice, newPrice, logoUrl, primaryColor,
}: {
  customerName: string;
  storeName: string;
  storeSubdomain: string;
  kind: "price_drop" | "back_in_stock";
  productName: string;
  productUrl: string;
  productImageUrl?: string;
  oldPrice?: string;
  newPrice?: string;
  logoUrl?: string;
  primaryColor?: string;
}) {
  const primary = primaryColor ?? "#0f766e";
  const isPriceDrop = kind === "price_drop";

  return (
    <EmailLayout
      brand={{ storeName, logoUrl, primaryColor: primary, poweredByColapia: false }}
      preheader={
        isPriceDrop
          ? `سعر "${productName}" انخفض — راجعه الآن`
          : `"${productName}" رجع متوفر تاني في ${storeName}`
      }
      footerNote={`أرسلنا هذه الرسالة من متجر ${storeName}.`}
      showUnsubscribe={true}
      unsubscribeUrl={`https://${storeSubdomain}/unsubscribe`}
    >
      <EmailHeading>
        {isPriceDrop ? "سعر المنتج انخفض" : "المنتج رجع متوفر"}
      </EmailHeading>

      <EmailParagraph>
        {customerName}،
      </EmailParagraph>

      <EmailParagraph>
        {isPriceDrop
          ? `خبر حلو! سعر "${productName}" اللي كنت مهتم بيه انخفض. الفرصة مناسبة للطلب قبل ما يرجع لسعره الأصلي.`
          : `"${productName}" اللي كنت بتدور عليه رجع متوفر في ${storeName}. الكميات محدودة، اطلب قبل ما ينفد تاني.`}
      </EmailParagraph>

      {/* Product preview card */}
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}
        style={{
          marginTop: "16px", border: "1px solid #eef1f7", borderRadius: "12px",
          padding: "16px", background: "#f8fafc",
        }}>
        <tbody>
          <tr>
            {productImageUrl ? (
              <td style={{ width: "80px", verticalAlign: "top", paddingInlineEnd: "14px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={productImageUrl} alt="" width={80} height={80}
                  style={{ display: "block", borderRadius: "10px", objectFit: "cover" }} />
              </td>
            ) : null}
            <td style={{ verticalAlign: "middle" }}>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#0b0f1f", marginBottom: "6px" }}>
                {productName}
              </div>
              {isPriceDrop && oldPrice && newPrice ? (
                <div style={{
                  display: "flex", alignItems: "baseline", gap: "10px",
                  flexDirection: "row", justifyContent: "flex-start",
                }}>
                  <span style={{
                    fontFamily: "'SF Mono', 'Menlo', monospace",
                    fontSize: "18px", fontWeight: 900, color: primary,
                    direction: "ltr",
                  }}>
                    {newPrice}
                  </span>
                  <span style={{
                    fontFamily: "'SF Mono', 'Menlo', monospace",
                    fontSize: "12px", color: "#94a3b8", textDecoration: "line-through",
                    direction: "ltr",
                  }}>
                    {oldPrice}
                  </span>
                </div>
              ) : null}
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        <EmailButton href={productUrl} primaryColor={primary}>
          {isPriceDrop ? "اطلب بسعره الجديد" : "اطلب قبل ما ينفد"}
        </EmailButton>
      </div>

      <EmailDivider />

      <EmailParagraph>
        شكراً لاهتمامك بـ {storeName}.
      </EmailParagraph>
    </EmailLayout>
  );
}