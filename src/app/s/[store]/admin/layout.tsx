import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireStore } from "@/lib/tenant";

type Props = { children: React.ReactNode; params: Promise<{ store: string }> };

export const metadata: Metadata = {
  title: "إدارة المتجر",
  robots: { index: false, follow: false },
};

export default async function StoreAdminLayout({ children, params }: Props) {
  const { store: sub } = await params;
  await requireStore(sub);
  const h = await headers();
  const pathname = (h.get("x-pathname") || "").toLowerCase();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans antialiased" data-admin-path={pathname}>
      {children}
    </div>
  );
}