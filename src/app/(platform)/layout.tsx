import type { Metadata, Viewport } from "next";
import { SITE_DESCRIPTION } from "@/lib/landing-content";
import { SITE_TITLE, siteOrigin } from "@/lib/platform-seo";

// metadataBase يلزم لروابط opengraph-image المطلقة. العنوان الافتراضي بالاسم الكامل للكيان (Colapia | كولابيا).
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: { default: SITE_TITLE, template: "%s | Colapia" },
  description: SITE_DESCRIPTION,
};

export const viewport: Viewport = {
  themeColor: "#07091a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * غلاف منصة Colapia (الهبوط، /admin، الصفحات القانونية).
 * data-brand يرفع هوية Cosmic Silver إلى <html> عبر :has في globals.css،
 * فتشمل الـ Portals والـ Toasts، بينما تبقى متاجر التجار على هوياتها الخاصة.
 */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-brand="colapia" className="relative isolate min-h-dvh bg-background text-foreground">
      <div aria-hidden className="cosmic-backdrop" />
      {children}
    </div>
  );
}
