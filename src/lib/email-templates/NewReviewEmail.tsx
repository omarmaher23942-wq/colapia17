// email-templates/NewReviewEmail.tsx — إشعار تقييم جديد للتاجر.
import {
  EmailLayout, EmailHeading, EmailParagraph, EmailButton,
  EmailDivider, EmailInfoBox,
} from "./_layout";

export function NewReviewEmail({
  storeName, productName, customerName, rating, reviewBody,
  reviewUrl, logoUrl,
}: {
  storeName: string;
  productName: string;
  customerName: string;
  rating: number;
  reviewBody?: string;
  reviewUrl: string;
  logoUrl?: string;
}) {
  const stars = "★★★★★".slice(0, rating) + "☆☆☆☆☆".slice(0, 5 - rating);

  return (
    <EmailLayout
      brand={{ storeName, logoUrl, primaryColor: "#0f766e" }}
      preheader={`تقييم جديد ${rating}/5 من ${customerName} على ${productName}`}
      footerNote={`إشعار مباشر من متجر ${storeName}.`}
    >
      <EmailHeading>وصلك تقييم جديد</EmailHeading>

      <EmailParagraph>
        <b>{customerName}</b> قيّم منتج <b>{productName}</b>:
      </EmailParagraph>

      <EmailInfoBox tone={rating >= 4 ? "success" : rating >= 3 ? "info" : "warning"}>
        <div style={{
          fontSize: "22px", color: rating >= 4 ? "#fbbf24" : "#64748b",
          letterSpacing: "3px", marginBottom: "8px", direction: "ltr",
          textAlign: "left",
        }}>
          {stars} <span style={{ fontSize: "14px", fontWeight: 800, color: "#0b0f1f" }}>
            {rating}/5
          </span>
        </div>
        {reviewBody ? (
          <div style={{ fontSize: "13.5px", lineHeight: 1.8, color: "#1f2937" }}>
            "{reviewBody}"
          </div>
        ) : null}
      </EmailInfoBox>

      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        <EmailButton href={reviewUrl} primaryColor="#0f766e">
          اعتمد التقييم في الداشبورد
        </EmailButton>
      </div>

      <EmailDivider />

      {rating >= 4 ? (
        <EmailParagraph>
          <strong>نصيحة:</strong> اعتمد التقييم وشاركه في استوري إنستجرام
          — التقييمات بتزيد ثقة العملاء الجداد وترفع معدل التحويل.
        </EmailParagraph>
      ) : (
        <EmailParagraph>
          <strong>نصيحة:</strong> لو التقييم سلبي، تواصل مع العميل فوراً
          — فرصة ذهبية لتحويل تجربة سيئة لعميل دائم.
        </EmailParagraph>
      )}
    </EmailLayout>
  );
}