import type { Metadata } from "next";
import { WorkPage } from "@/components/landing/InfoPages";
import { getSessionState } from "@/components/landing/session";
import { BRAND } from "@/lib/landing-content";
import { graphFor, jsonLdText, pageMetadata, siteOrigin } from "@/lib/platform-seo";

export const metadata: Metadata = pageMetadata("work", {
  title: `أعمالنا | ${BRAND.fullName} — موقع Qima ومتجر العرض`,
  description: "مشاريع نفّذتها Colapia (كولابيا): موقع Qima لوكالة إنتاج محتوى مرئي بالعربية والإنجليزية، ومتجر العرض الإلكتروني التجريبي الكامل.",
  absoluteTitle: true,
});

export default async function Page() {
  const session = await getSessionState();
  const origin = siteOrigin();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(graphFor("work", origin)) }} />
      <WorkPage session={session} origin={origin} />
    </>
  );
}
