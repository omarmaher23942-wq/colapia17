// أزرار الدعوة الموحدة: البدء بمحادثة على إنستجرام، ولوحة التحكم للعملاء (أو تسجيل الدخول بلا جلسة).
import Link from "next/link";
import { Instagram, LayoutDashboard, LogIn } from "lucide-react";
import { BRAND } from "@/lib/landing-content";
import { CTA_GHOST, CTA_PRIMARY } from "./shared";
import type { SessionState } from "./types";

export function Ctas({ session, className = "" }: { session: SessionState; className?: string }) {
  const client = session === "merchant";
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <a href={BRAND.igDm} target="_blank" rel="noopener noreferrer" className={CTA_PRIMARY}>
        <Instagram className="size-5" aria-hidden="true" /> ابدأوا مشروعكم على إنستجرام
      </a>
      <Link href={client ? "/dashboard" : "/login?redirect=/dashboard"} className={CTA_GHOST}>
        {client ? <LayoutDashboard className="size-4" aria-hidden="true" /> : <LogIn className="size-4" aria-hidden="true" />}
        {client ? "لوحة التحكم" : "تسجيل الدخول"}
      </Link>
    </div>
  );
}
