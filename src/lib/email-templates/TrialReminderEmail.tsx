// email-templates/TrialReminderEmail.tsx — تذكير بنهاية التجربة.
import {
  EmailLayout, EmailHeading, EmailParagraph, EmailButton,
  EmailDivider, EmailInfoBox,
} from "./_layout";

export function TrialReminderEmail({
  merchantName, storeName, hoursLeft, activateUrl,
  priceEgp, basePriceEgp, logoUrl,
}: {
  merchantName: string;
  storeName: string;
  hoursLeft: number;
  activateUrl: string;
  priceEgp: number;
  basePriceEgp: number;
  logoUrl?: string;
}) {
  const isUrgent = hoursLeft <= 6;
  const savings = basePriceEgp - priceEgp;

  return (
    <EmailLayout
      brand={{ storeName: "Colapia", logoUrl, primaryColor: "#0f766e" }}
      preheader={
        isUrgent
          ? `باقي ${hoursLeft} ساعة على انتهاء تجربة ${storeName}`
          : `باقي ${hoursLeft} ساعة لتفعيل متجر ${storeName}`
      }
      footerNote={`إشعار من منصة Colapia بخصوص تجربة متجر ${storeName}.`}
    >
      <EmailHeading>
        {isUrgent ? `⏱ باقي ${hoursLeft} ساعة` : `باقي ${hoursLeft} ساعة`}
      </EmailHeading>

      <EmailParagraph>
        {merchantName}،
      </EmailParagraph>

      <EmailParagraph>
        {isUrgent
          ? `متجر "${storeName}" هيتجمد خلال ${hoursLeft} ساعة لو ما اتُفعّلش. عشان تحافظ على متجرك شغال، فعّله الآن بالباقة (${priceEgp} ج تشمل سنة استضافة).`
          : `تجربة متجر "${storeName}" قربت تنتهي. عشان تضمن متجرك شغال، فعّله بالباقة (${priceEgp} ج تشمل سنة استضافة).`}
      </EmailParagraph>

      <EmailInfoBox tone={isUrgent ? "warning" : "info"}>
        <strong>عرض الإطلاق (لفترة محدودة)</strong>
        <br />
        بدلاً من <span style={{ textDecoration: "line-through", color: "#64748b" }}>
          {basePriceEgp.toLocaleString("en-US")} ج
        </span>{" "}
        → <b style={{ color: "#0f766e", fontSize: "16px" }}>{priceEgp} ج فقط</b>
        <br />
        <span style={{ fontSize: "12px", color: "#64748b" }}>
          وفّر {savings.toLocaleString("en-US")} ج — الباقة تشمل سنة استضافة كاملة، بلا عمولة.
        </span>
      </EmailInfoBox>

      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        <EmailButton href={activateUrl} primaryColor="#0f766e">
          فعّل متجرك الآن
        </EmailButton>
      </div>

      <EmailDivider />

      <EmailParagraph>
        <strong>ليه التفعيل؟</strong> عشان متجرك يستقبل طلبات من عملائك بشكل
        دائم، من غير توقف، ومن غير أي عمولة على مبيعاتك.
      </EmailParagraph>

      <EmailParagraph>
        لو عندك سؤال قبل التفعيل، فريقنا جاهز للمساعدة على مدار اليوم.
      </EmailParagraph>
    </EmailLayout>
  );
}