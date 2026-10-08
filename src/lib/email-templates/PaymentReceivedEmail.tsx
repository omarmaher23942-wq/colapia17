// email-templates/PaymentReceivedEmail.tsx — تأكيد استلام دفعة (للتاجر).
import {
  EmailLayout,
  EmailHeading,
  EmailParagraph,
  EmailButton,
  EmailDivider,
  EmailInfoBox,
} from "./_layout";

export function PaymentReceivedEmail({
  storeName,
  amount,
  method,
  senderPhone,
  orderCode,
  orderUrl,
  logoUrl,
}: {
  storeName: string;
  amount: string;
  method: "vodafone_cash" | "instapay" | "cod";
  senderPhone?: string;
  orderCode?: string;
  orderUrl: string;
  logoUrl?: string;
}) {
  const methodLabel =
    method === "vodafone_cash"
      ? "فودافون كاش"
      : method === "instapay"
      ? "إنستاباي"
      : "دفع عند الاستلام";

  return (
    <EmailLayout
      brand={{
        storeName,
        logoUrl,
        primaryColor: "#0f766e",
      }}
      preheader={`وصلك ${amount} — تأكيد دفعة`}
      footerNote={`إشعار مباشر من متجر ${storeName}.`}
    >
      <EmailHeading>وصلك دفع جديد</EmailHeading>

      <EmailParagraph>
        تمام، استلمنا إشعار دفع في متجرك. إليك التفاصيل:
      </EmailParagraph>

      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        border={0}
        style={{
          marginTop: "8px",
          border: "1px solid #eef1f7",
          borderRadius: "12px",
          padding: "4px 16px",
        }}
      >
        <tbody>
          <Row label="المبلغ" value={amount} mono />
          <Row label="الطريقة" value={methodLabel} />
          {senderPhone ? <Row label="من رقم" value={senderPhone} mono ltr /> : null}
          {orderCode ? <Row label="رقم الطلب" value={orderCode} mono ltr /> : null}
        </tbody>
      </table>

      <EmailInfoBox tone="success">
        <strong>تم تسجيل الدفعة في النظام بنجاح.</strong>
        <br />
        راجع تفاصيل الطلب من لوحة التحكم لتأكيد الطلب أو تجهيزه للشحن.
      </EmailInfoBox>

      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        <EmailButton href={orderUrl} primaryColor="#0f766e">
          راجع الطلب في الداشبورد
        </EmailButton>
      </div>

      <EmailDivider />

      <EmailParagraph>
        <strong>ملاحظة:</strong> في حالة وجود أي شك في صحة الدفعة، يمكنك
        رفضها من لوحة التحكم وسيتم إشعار العميل تلقائياً.
      </EmailParagraph>
    </EmailLayout>
  );
}

function Row({
  label,
  value,
  mono,
  ltr,
}: {
  label: string;
  value: string;
  mono?: boolean;
  ltr?: boolean;
}) {
  return (
    <tr>
      <td
        style={{
          padding: "12px 0",
          borderBottom: "1px solid #eef1f7",
          fontSize: "13.5px",
          color: "#64748b",
          width: "40%",
        }}
      >
        {label}
      </td>
      <td
        style={{
          padding: "12px 0",
          borderBottom: "1px solid #eef1f7",
          fontSize: "14px",
          fontWeight: 800,
          color: "#0b0f1f",
          textAlign: "left",
          fontFamily: mono
            ? "'SF Mono', 'Menlo', monospace"
            : "inherit",
          direction: ltr ? "ltr" : "rtl",
        }}
      >
        {value}
      </td>
    </tr>
  );
}