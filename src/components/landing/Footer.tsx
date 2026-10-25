// فوتر المنصة: تعريف الكيان بالاسم نفسه، وأعمدة روابط، وروابط قانونية.
import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";
import { BRAND } from "@/lib/landing-content";

const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "الوكالة",
    links: [
      { label: "الخدمات", href: "/#services" },
      { label: "كيف نعمل", href: "/#process" },
      { label: "أعمالنا", href: "/work" },
      { label: "من نحن", href: "/about" },
      { label: "الأسئلة الشائعة", href: "/#faq" },
    ],
  },
  {
    title: "تواصلوا معنا",
    links: [
      { label: "ابدأوا من إنستجرام", href: BRAND.igDm, external: true },
      { label: BRAND.email, href: `mailto:${BRAND.email}`, external: true },
      { label: "لوحة التحكم", href: "/dashboard" },
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

export function Footer() {
  return (
    <footer className="border-t border-white/10 py-16">
      <div className="container-x">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <ColapiaLogo size={32} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#c3cdf0]/70">
              Colapia (كولابيا) وكالة تصميم وبرمجة مواقع ومتاجر وأنظمة، تسلّم عملاءها الكود كاملاً ليملكوه.
            </p>
            <div className="mt-5 flex flex-col gap-2 text-sm text-[#c3cdf0]/70">
              <span className="inline-flex items-center gap-2">
                <MapPin className="size-4 text-[#8fa8ff]" aria-hidden="true" />
                مصر
              </span>
              <a href={`mailto:${BRAND.email}`} className="inline-flex items-center gap-2 transition-colors hover:text-[#8fa8ff]" dir="ltr">
                <Mail className="size-4 text-[#8fa8ff]" aria-hidden="true" />
                {BRAND.email}
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="mb-4 text-sm font-bold text-[#eaf0ff]">{col.title}</h2>
              <ul className="flex flex-col gap-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a href={l.href} {...(l.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="text-sm text-[#c3cdf0]/70 transition-colors hover:text-[#8fa8ff]">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="text-sm text-[#c3cdf0]/70 transition-colors hover:text-[#8fa8ff]">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 border-t border-white/10 pt-8 text-center sm:text-start">
          <span className="text-xs text-[#c3cdf0]/60">© {new Date().getFullYear()} Colapia | كولابيا. جميع الحقوق محفوظة.</span>
        </div>
      </div>
    </footer>
  );
}
