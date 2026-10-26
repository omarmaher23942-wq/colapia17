import type { Metadata } from "next";
import { AboutPage } from "@/components/landing/InfoPages";
import { getSessionState } from "@/components/landing/session";
import { ABOUT, BRAND } from "@/lib/landing-content";
import { graphFor, jsonLdText, pageMetadata, siteOrigin } from "@/lib/platform-seo";

export const metadata: Metadata = pageMetadata("about", {
  title: `من نحن | ${BRAND.fullName}`,
  description: ABOUT.lead,
  absoluteTitle: true,
});

export default async function Page() {
  const session = await getSessionState();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(graphFor("about", siteOrigin())) }} />
      <AboutPage session={session} />
    </>
  );
}
