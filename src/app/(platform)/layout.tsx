import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: { default: "Colapia", template: "%s | Colapia" },
  description: "متجرك الإلكتروني الاحترافي جاهز بمنتجاتك الحقيقية في أقل من 12 ساعة، جرّبه 24 ساعة قبل أن تدفع.",
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
