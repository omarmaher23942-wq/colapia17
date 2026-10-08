// email-templates/TrialEndedEmail.tsx — انتهت التجربة والمتجر محفوظ.
import {
  EmailLayout, EmailHeading, EmailParagraph, EmailButton,
  EmailDivider, EmailInfoBox,
} from "./_layout";

export function TrialEndedEmail({
  merchantName, storeName, graceDaysLeft, activateUrl,
  priceEgp, logoUrl,
}: {
  merchantName: string;
  storeName: string;
  graceDaysLeft: number;
  activateUrl: string;
  priceEgp: number;
  logoUrl?: string;
}) {
  return (
    <EmailLayout
      brand={{ storeName: "Colapia", logoUrl, primaryColor: "#0f766e" }}
      preheader={`متجر ${storeName} محفوظ ليك لمدة ${graceDaysLeft} يوم — فعّله قبل الحذف`}
      footerNote={`إشعار من منصة Colapia بخصوص متجر ${storeName}.`}
    >
      <EmailHeading>متجرك محفوظ ليك</EmailHeading>

      <EmailParagraph>
        {merchantName}،
      </EmailParagraph>

      <EmailParagraph>
        انتهت فترة التجربة المجانية لمتجر <b>{storeName}</b>، بس بياناتك
        كاملة محفوظة ليك: المنتجات، الطلبات، العملاء، كل حاجة.
      </EmailParagraph>

      <EmailInfoBox tone="warning">
        <strong>فاضل أيام قليلة قبل الحذف النهائي</strong>
        <br />
        عندك <b>{graceDaysLeft} يوم</b> لتفعيل المتجر والحفاظ عليه. بعدها
        هيتحذف نهائياً — وما فيش إمكانية رجوع.
      </EmailInfoBox>

      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        <EmailButton href={activateUrl} primaryColor="#0f766e">
          فعّل متجرك للأبد ({priceEgp} ج)
        </EmailButton>
      </div>

      <EmailDivider />

      <EmailParagraph>
        <strong>تفعيل المتجر =</strong> ملكية أبدية، بلا اشتراكات، بلا
        عمولة على المبيعات، وتحديثات دائمة. دفعة واحدة فقط.
      </EmailParagraph>

      <EmailParagraph>
        لو عندك أي سؤال أو صعوبة في التفعيل، تواصل معنا وهنساعدك فوراً.
      </EmailParagraph>
    </EmailLayout>
  );
}