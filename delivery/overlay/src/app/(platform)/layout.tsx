// غلاف صفحات صاحب المتجر (لوحة التحكم، الدخول، الإعداد). اللوحة لها تصميمها الخاص.
import type { Metadata, Viewport } from "next";
import { STORE } from "@/store.config";

export const metadata: Metadata = {
  title: { default: `لوحة تحكم ${STORE.name}`, template: `%s · ${STORE.name}` },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#07091a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <div className="relative isolate min-h-dvh bg-background text-foreground">{children}</div>;
}
