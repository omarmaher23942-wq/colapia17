// الصفحة الرئيسية لـ Colapia (خادم): تقرأ وجود كوكي الجلسة فقط (بلا قاعدة بيانات) لتبقى سريعة، وتحقن البيانات المنظمة
// (Organization وProfessionalService وWebSite وFAQPage) من مصدر النصوص الواحد في lib/platform-seo.ts.
import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";
import { getSessionState } from "@/components/landing/session";
import { HOME_META, graphFor, jsonLdText, pageMetadata, siteOrigin } from "@/lib/platform-seo";

export const metadata: Metadata = pageMetadata("home", HOME_META);

export default async function Page() {
  const session = await getSessionState();
  const origin = siteOrigin();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(graphFor("home", origin)) }} />
      <Landing session={session} origin={origin} />
    </>
  );
}
