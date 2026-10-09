// app/layout.tsx — الجذر العام لمنصة Colapia.
//
// أيقونات المنصة:
// - نستخدم /logo.png لكل الأحجام (tab, apple, PWA).
// - لا نستخدم SVG لأن المتصفحات تتعامل مع PNG بشكل أكثر اتساقاً.
// - الـ manifest يُكمل الصورة للـ PWA على الديسكتوب.
import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import { AppToaster } from "@/components/AppToaster";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Colapia", template: "%s | Colapia" },
  description: "متجرك الإلكتروني الاحترافي في أقل من 10 دقائق",
  applicationName: "Colapia",
  authors: [{ name: "Colapia" }],
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
    ],
    apple: [
      { url: "/logo.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/logo.png"],
  },
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#07091a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={fontVariables}
    >
      <body className="min-h-dvh">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
          <AppToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}