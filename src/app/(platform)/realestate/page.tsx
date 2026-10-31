// colapia.com/realestate — استمارة «موقعكم العقاري»: يملؤها العميل في دقائق، وتصل إلى لوحة المالك (/admin/briefs) فوراً.
import type { Metadata, Viewport } from "next";
import { env } from "@/lib/env";
import { BRAND } from "@/lib/landing-content";
import { RealEstateBriefForm } from "@/components/briefs/RealEstateBriefForm";

// رقم واتساب الوكالة يُقرأ وقت الطلب (لا يُثبَّت وقت البناء).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "استمارة موقعكم العقاري",
  description: "أسئلة قصيرة في نحو 3 دقائق نفهم بها نشاطكم العقاري وما تريدونه من موقعكم، ثم نبني موقعكم ولوحة تحكمه ونسلّمهما لكم.",
  alternates: { canonical: "/realestate" },
  robots: { index: false, follow: false },
  openGraph: {
    title: "استمارة موقعكم العقاري | Colapia",
    description: "دقائق قليلة تفصلكم عن موقع عقاري احترافي بلوحة تحكم ذكية.",
    type: "website",
    locale: "ar_EG",
  },
};

export const viewport: Viewport = { themeColor: "#07091a", colorScheme: "dark", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RealEstateBriefPage() {
  return <RealEstateBriefForm agencyWhatsapp={env.AGENCY_WHATSAPP ?? null} instagramUrl={BRAND.igDm} />;
}
