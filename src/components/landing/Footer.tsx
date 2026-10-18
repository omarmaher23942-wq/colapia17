// فوتر بأعمدة وروابط قانونية.
import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";

const columns = (igUrl: string): { title: string; links: { label: string; href: string }[] }[] => [
  {
    title: "المنتج",
    links: [
      { label: "كيف يعمل", href: "#how" },
            { label: "لوحة التحكم", href: "#dashboard" },
      { label: "المميزات", href: "#features" },
      { label: "الباقات", href: "#pricing" },
      { label: "الأسئلة الشائعة", href: "#faq" },
    ],
  },
  {
    title: "الشركة",
    links: [
      { label: "ابدأوا من إنستجرام", href: igUrl },
      { label: "تواصل معنا", href: "mailto:support@colapia.com" },
    ],
  },
  {
    title: "قانوني",
    links: [
      { label: "سياسة الخصوصية", href: "/privacy" },
      { label: "الشروط والأحكام", href: "/terms" },
      { label: "حذف البيانات", href: "/data-deletion" },
    ],
  },
];

export function Footer({ igUrl = "https://ig.me/m/colapia" }: { igUrl?: string }) {
  return (
    <footer className="border-t border-white/10 py-16">
      <div className="container-x">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <ColapiaLogo size={32} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#c3cdf0]/60">
              فريق مصري يبني متجرك ويستضيفه ويشغّله،
              بلا عمولة على مبيعاتك.
            </p>
            <div className="mt-5 flex flex-col gap-2 text-sm text-[#c3cdf0]/60">
              <span className="inline-flex items-center gap-2">
                <MapPin className="size-4 text-[#8fa8ff]" aria-hidden="true" />
                مصر
              </span>
              <a
                href="mailto:support@colapia.com"
                className="inline-flex items-center gap-2 transition-colors hover:text-[#8fa8ff]"
                dir="ltr"
              >
                <Mail className="size-4 text-[#8fa8ff]" aria-hidden="true" />
                support@colapia.com
              </a>
            </div>
          </div>

          {columns(igUrl).map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-sm font-bold text-[#eaf0ff]">{col.title}</h4>
              <ul className="flex flex-col gap-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-[#c3cdf0]/60 transition-colors hover:text-[#8fa8ff]">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 border-t border-white/10 pt-8 text-center sm:text-start">
          <span className="text-xs text-[#c3cdf0]/50">© {new Date().getFullYear()} Colapia. جميع الحقوق محفوظة.</span>
        </div>
      </div>
    </footer>
  );
}