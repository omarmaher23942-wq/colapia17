// email-templates/AbandonedCartEmail.tsx — استرداد سلة متروكة.
import {
  EmailLayout,
  EmailHeading,
  EmailParagraph,
  EmailButton,
  EmailDivider,
  EmailInfoBox,
  EmailOrderLine,
} from "./_layout";

export function AbandonedCartEmail({
  customerName,
  storeName,
  cartUrl,
  items,
  subtotal,
  discountCode,
  discountValue,
  logoUrl,
  primaryColor,
  storeSubdomain,
}: {
  customerName: string;
  storeName: string;
  cartUrl: string;
  items: Array<{ name: string; variant?: string; qty: number; total: string }>;
  subtotal: string;
  discountCode?: string;
  discountValue?: string;
  logoUrl?: string;
  primaryColor?: string;
  storeSubdomain?: string;
}) {
  const primary = primaryColor ?? "#0f766e";
  const preview = items.slice(0, 5);
  const remaining = items.length - preview.length;

  return (
    <EmailLayout
      brand={{
        storeName,
        logoUrl,
        primaryColor: primary,
        poweredByColapia: false,
      }}
      preheader={`نسيت حاجة في سلتك؟ راجع طلبك في ${storeName}`}
      footerNote={`أرسلنا هذه الرسالة من متجر ${storeName}.`}
      showUnsubscribe={true}
      unsubscribeUrl={`https://${storeSubdomain ?? "colapia.com"}/unsubscribe`}
    >
      <EmailHeading>نسيت حاجة في سلتك</EmailHeading>

      <EmailParagraph>
        {customerName}،
      </EmailParagraph>

      <EmailParagraph>
        لاحظنا إنك بدأت طلب من <b>{storeName}</b> ومكملتش. الحاجة اللي
        اخترتها لسه محفوظة في سلتك، بس مش مضمونة تكون متوفرة دايماً.
      </EmailParagraph>

      {/* Cart preview */}
      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        border={0}
        style={{
          marginTop: "16px",
          border: "1px solid #eef1f7",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <tbody>
          {preview.map((item, i) => (
            <EmailOrderLine
              key={i}
              name={item.name}
              variant={item.variant}
              qty={item.qty}
              total={item.total}
            />
          ))}
          {remaining > 0 ? (
            <tr>
              <td
                colSpan={3}
                style={{
                  padding: "10px 0",
                  fontSize: "12px",
                  textAlign: "center",
                  color: "#64748b",
                }}
              >
                و {remaining} منتجات أخرى في سلتك…
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {/* Subtotal */}
      <div
        style={{
          marginTop: "16px",
          padding: "14px 16px",
          background: "#f8fafc",
          borderRadius: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "14px", color: "#64748b" }}>
          مجموع السلة:
        </span>
        <span
          style={{
            fontSize: "18px",
            fontWeight: 900,
            color: "#0b0f1f",
            fontFamily: "'SF Mono', 'Menlo', monospace",
            direction: "ltr",
          }}
        >
          {subtotal}
        </span>
      </div>

      {/* Discount incentive */}
      {discountCode ? (
        <EmailInfoBox tone="success">
          <strong>عرض خاص لك:</strong>
          <br />
          استخدم الكود <b style={{ color: primary, fontFamily: "'SF Mono', 'Menlo', monospace" }}>
            {discountCode}
          </b>
          {discountValue ? ` للحصول على ${discountValue}` : ""}
          {" "}— العرض ساري لفترة محدودة.
        </EmailInfoBox>
      ) : null}

      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        <EmailButton href={cartUrl} primaryColor={primary}>
          أكمل طلبك الآن
        </EmailButton>
      </div>

      <EmailDivider />

      <EmailParagraph>
        <strong>عندك سؤال؟</strong> فريق {storeName} جاهز لمساعدتك على
        الواتساب أو من صفحة المتجر.
      </EmailParagraph>
    </EmailLayout>
  );
}