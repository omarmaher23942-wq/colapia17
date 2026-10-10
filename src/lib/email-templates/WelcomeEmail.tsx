// email-templates/WelcomeEmail.tsx — ترحيب بالتاجر بعد التسجيل.
import {
  EmailLayout,
  EmailHeading,
  EmailParagraph,
  EmailButton,
  EmailDivider,
  EmailInfoBox,
} from "./_layout";

export function WelcomeEmail({
  merchantName,
  storeName,
  dashboardUrl,
  logoUrl,
}: {
  merchantName: string;
  storeName?: string;
  dashboardUrl: string;
  logoUrl?: string;
}) {
  return (
    <EmailLayout
      brand={{
        storeName: "Colapia",
        logoUrl,
        primaryColor: "#0f766e",
      }}
      preheader="أهلاً بك في Colapia — ابدأ ببناء متجرك الإلكتروني"
      footerNote="أنت تتلقى هذا البريد لأنك سجّلت حساباً جديداً في منصة Colapia."
    >
      <EmailHeading>أهلاً بك، {merchantName}</EmailHeading>

      <EmailParagraph>
        مبروك! انضممت إلى Colapia، المنصة التي تبني متاجر إلكترونية احترافية
        للتجار المصريين والعرب — خلال دقائق، وتستضيفه وتشغّله لك، وبلا أي عمولة
        على مبيعاتك.
      </EmailParagraph>

      <EmailParagraph>
        {storeName
          ? `بدأنا العمل على متجر "${storeName}". ستصلك رسالة أخرى فور جاهزيته.`
          : "خطوتك التالية: ابدأ استمارة بناء متجرك — دقيقتان فقط تفصلك عن متجر احترافي جاهز."}
      </EmailParagraph>

      <EmailDivider />

      <EmailInfoBox tone="info">
        <strong>ما يمكنك فعله الآن:</strong>
        <ul style={{ margin: "8px 0 0", padding: "0 20px" }}>
          <li style={{ marginBottom: "4px" }}>
            ابدأ استمارة بناء متجرك (دقيقتان فقط)
          </li>
          <li style={{ marginBottom: "4px" }}>
            احصل على تجربة مجانية كاملة
          </li>
          <li style={{ marginBottom: "4px" }}>
            فعّل متجرك بباقة تشمل سنة استضافة كاملة
          </li>
        </ul>
      </EmailInfoBox>

      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        <EmailButton href={dashboardUrl} primaryColor="#0f766e">
          افتح لوحة التحكم
        </EmailButton>
      </div>

      <EmailParagraph>
        لو عندك أي سؤال، فريقنا جاهز للمساعدة على مدار اليوم.
      </EmailParagraph>
    </EmailLayout>
  );
}