// email-templates/OrderDeliveredReviewEmail.tsx — إشعار استلام + طلب تقييم.
import {
  EmailLayout,
  EmailHeading,
  EmailParagraph,
  EmailButton,
  EmailDivider,
  EmailInfoBox,
} from "./_layout";

export function OrderDeliveredReviewEmail({
  customerName,
  storeName,
  orderCode,
  reviewUrl,
  logoUrl,
  primaryColor,
}: {
  customerName: string;
  storeName: string;
  orderCode: string;
  reviewUrl: string;
  logoUrl?: string;
  primaryColor?: string;
}) {
  const primary = primaryColor ?? "#0f766e";

  return (
    <EmailLayout
      brand={{
        storeName,
        logoUrl,
        primaryColor: primary,
        poweredByColapia: false,
      }}
      preheader={`وصلك طلبك ${orderCode}؟ شاركنا رأيك`}
      footerNote={`أرسلنا هذه الرسالة من متجر ${storeName}.`}
    >
      <EmailHeading>نتمنى أن تكون سعيداً بطلبك</EmailHeading>

      <EmailParagraph>
        {customerName}،
      </EmailParagraph>

      <EmailParagraph>
        وصلنا إشعار بأن طلبك <b>{orderCode}</b> تم توصيله بنجاح. نتمنى أنه
        لبّى توقعاتك وعجبك تماماً.
      </EmailParagraph>

      <EmailInfoBox tone="info">
        <strong>رأيك يهمنا كثيراً</strong>
        <br />
        تقييمك يساعد عملاء آخرين على الاختيار، ويساعدنا نحسّن تجربتك.
        يستغرق أقل من دقيقة.
      </EmailInfoBox>

      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        <EmailButton href={reviewUrl} primaryColor={primary}>
          اكتب تقييمك الآن
        </EmailButton>
      </div>

      <EmailDivider />

      <EmailParagraph>
        <strong>هل عندك مشكلة؟</strong> تواصل معنا مباشرة من صفحة متجرنا،
        وسنحل أي استفسار فوراً.
      </EmailParagraph>

      <EmailParagraph>
        شكراً لتعاملك مع {storeName}. نتطلع لخدمتك مرة أخرى.
      </EmailParagraph>
    </EmailLayout>
  );
}