// emails.tsx — بريد طلبات المتاجر (نموذج الوكالة): تأكيد للعميل، وتنبيه فوري للمالك والفريق، وتحديث مرحلة.
// كل نص كتبه العميل يُمرَّر كنص React (يُهرَّب تلقائياً)، والروابط https فقط، والصور من UploadThing فقط.
import { EmailButton, EmailDivider, EmailHeading, EmailInfoBox, EmailLayout, EmailParagraph } from "@/lib/email-templates/_layout";
import { isTrustedUploadUrl } from "@/lib/upload-hosts";

const BRAND = { storeName: "Colapia", primaryColor: "#4f5fd9" };
const FOOTER = "Colapia — فريق يصمم ويبني ويستضيف متاجر التجار.";

export function RequestReceivedClientEmail(p: {
  storeName: string;
  code: string;
  etaText: string;
  followUrl: string;
  confirmUrl?: string | null;
  agencyWhatsappUrl?: string | null;
}) {
  return (
    <EmailLayout brand={BRAND} preheader={`استلمنا طلب متجر «${p.storeName}» (${p.code})`} footerNote={FOOTER}>
      <EmailHeading>استلمنا طلب متجرك</EmailHeading>
      <EmailParagraph>
        شكراً لثقتك. وصلنا طلب متجر «{p.storeName}» برقم {p.code}، وفريق Colapia هيراجع معلوماتك ويبدأ التصميم.
      </EmailParagraph>
      <EmailInfoBox tone="info">
        <strong>موعد التسليم المتوقع:</strong> {p.etaText} من وقت إرسال الطلب، بعد ما الفريق يراجع المتجر. لو احتجنا أي تفصيلة هنراسلك.
      </EmailInfoBox>
      <EmailParagraph>من صفحة المتابعة تقدر تشوف المرحلة اللي فيها متجرك دلوقتي وملاحظات الفريق أول بأول.</EmailParagraph>
      <p style={{ margin: "18px 0" }}>
        <EmailButton href={p.followUrl} primaryColor={BRAND.primaryColor}>
          تابع متجرك
        </EmailButton>
      </p>
      {p.confirmUrl ? (
        <>
          <EmailDivider />
          <EmailParagraph>
            أكّد بريدك بضغطة واحدة عشان نتأكد إنه وصلك، وهنستخدمه في التواصل معاك وفي الدخول للوحة تحكم متجرك:
          </EmailParagraph>
          <p style={{ margin: "12px 0" }}>
            <EmailButton href={p.confirmUrl} variant="ghost">
              أكّد بريدي
            </EmailButton>
          </p>
        </>
      ) : null}
      {p.agencyWhatsappUrl ? (
        <EmailParagraph>
          عندك سؤال؟ <a href={p.agencyWhatsappUrl}>كلّمنا على واتساب</a> واذكر رقم الطلب {p.code}.
        </EmailParagraph>
      ) : null}
    </EmailLayout>
  );
}

export type TeamAlertRow = { label: string; value: string };

export function RequestTeamAlertEmail(p: {
  storeName: string;
  code: string;
  adminUrl: string;
  whatsappUrl?: string | null;
  rows: TeamAlertRow[];
  images: string[];
  voiceUrl?: string | null;
  transcript?: string | null;
  notes?: string | null;
  etaText: string;
}) {
  const images = p.images.filter(isTrustedUploadUrl).slice(0, 8);
  return (
    <EmailLayout brand={BRAND} preheader={`طلب متجر جديد: ${p.storeName} (${p.code})`} footerNote="تنبيه داخلي لفريق Colapia.">
      <EmailHeading>طلب متجر جديد: {p.storeName}</EmailHeading>
      <EmailParagraph>
        رقم الطلب {p.code}. الموعد الذي ظهر للعميل: {p.etaText}.
      </EmailParagraph>
      <table role="presentation" width="100%" style={{ borderCollapse: "collapse", margin: "8px 0 16px" }}>
        <tbody>
          {p.rows.map((r) => (
            <tr key={r.label}>
              <td style={{ padding: "6px 0", width: "38%", fontSize: "13px", color: "#64748b", verticalAlign: "top" }}>{r.label}</td>
              <td style={{ padding: "6px 0", fontSize: "14px", color: "#0b0f1f", fontWeight: 700 }}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {p.notes ? (
        <EmailInfoBox>
          <strong>ملاحظات العميل:</strong> {p.notes}
        </EmailInfoBox>
      ) : null}
      {p.transcript ? (
        <EmailInfoBox tone="info">
          <strong>تفريغ الرسالة الصوتية (آلي):</strong> {p.transcript}
        </EmailInfoBox>
      ) : null}
      {p.voiceUrl && isTrustedUploadUrl(p.voiceUrl) ? (
        <EmailParagraph>
          <a href={p.voiceUrl}>اسمع الرسالة الصوتية</a>
        </EmailParagraph>
      ) : null}
      {images.length ? (
        <p style={{ margin: "12px 0" }}>
          {images.map((src) => (
            <a key={src} href={src} style={{ display: "inline-block", margin: "0 0 6px 6px" }}>
              <img src={src} width={120} height={120} alt="" style={{ width: "120px", height: "120px", objectFit: "cover", borderRadius: "10px", border: "1px solid #e2e8f0" }} />
            </a>
          ))}
        </p>
      ) : null}
      <p style={{ margin: "18px 0" }}>
        <EmailButton href={p.adminUrl} primaryColor={BRAND.primaryColor}>
          افتح الطلب في اللوحة
        </EmailButton>{" "}
        {p.whatsappUrl ? (
          <EmailButton href={p.whatsappUrl} variant="ghost">
            واتساب العميل
          </EmailButton>
        ) : null}
      </p>
    </EmailLayout>
  );
}

export function StageChangedClientEmail(p: { storeName: string; code: string; stageLabel: string; stageText: string; note?: string | null; followUrl: string }) {
  return (
    <EmailLayout brand={BRAND} preheader={`متجر «${p.storeName}»: ${p.stageLabel}`} footerNote={FOOTER}>
      <EmailHeading>
        متجر «{p.storeName}»: {p.stageLabel}
      </EmailHeading>
      <EmailParagraph>{p.stageText}</EmailParagraph>
      {p.note ? (
        <EmailInfoBox tone="info">
          <strong>من الفريق:</strong> {p.note}
        </EmailInfoBox>
      ) : null}
      <p style={{ margin: "18px 0" }}>
        <EmailButton href={p.followUrl} primaryColor={BRAND.primaryColor}>
          تابع متجرك
        </EmailButton>
      </p>
      <EmailParagraph>رقم الطلب {p.code}.</EmailParagraph>
    </EmailLayout>
  );
}
