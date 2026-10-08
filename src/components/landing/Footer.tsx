// فوتر غني بأربعة أعمدة، شعارات شركاء تقنيين، وروابط قانونية كاملة.
import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "المنتج",
    links: [
      { label: "كيف يعمل", href: "#how" },
      { label: "المميزات", href: "#features" },
      { label: "الأسعار", href: "#pricing" },
      { label: "الأسئلة الشائعة", href: "#faq" },
    ],
  },
  {
    title: "الشركة",
    links: [
      { label: "الملكية", href: "#ownership" },
      { label: "تواصل معنا", href: "mailto:omarmaher23942@gmail.com" },
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

function PartnerBadge({ name }: { name: string }) {
  return (
    <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-[#c3cdf0]/60">
      {name}
    </span>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/10 py-16">
      <div className="container-x">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <ColapiaLogo size={32} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#c3cdf0]/60">
              منصة مصرية تبني متاجر إلكترونية احترافية للتجار العرب بالذكاء
              الاصطناعي — بملكية أبدية وبلا عمولة.
            </p>
            <div className="mt-5 flex flex-col gap-2 text-sm text-[#c3cdf0]/60">
              <span className="inline-flex items-center gap-2">
                <MapPin className="size-4 text-[#8fa8ff]" aria-hidden="true" />
                مصر
              </span>
              <a
                href="mailto:omarmaher23942@gmail.com"
                className="inline-flex items-center gap-2 transition-colors hover:text-[#8fa8ff]"
                dir="ltr"
              >
                <Mail className="size-4 text-[#8fa8ff]" aria-hidden="true" />
                omarmaher23942@gmail.com
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
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

        <div className="mt-14 flex flex-col items-center justify-between gap-6 border-t border-white/10 pt-8 sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#c3cdf0]/50">مبني باستخدام</span>
            <div className="flex items-center gap-2">
              <PartnerBadge name="Vercel" />
              <PartnerBadge name="Neon" />
              <PartnerBadge name="Upstash" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <select
              aria-label="اختر اللغة"
              defaultValue="ar"
              className="rounded-lg border border-white/10 bg-transparent px-3 py-1.5 text-xs text-[#c3cdf0]/70"
            >
              <option value="ar">العربية</option>
              <option value="en" disabled>
                English — قريباً
              </option>
            </select>
            <span className="text-xs text-[#c3cdf0]/50">
              © {new Date().getFullYear()} Colapia. جميع الحقوق محفوظة.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}