// Contact — قسم «تواصل معنا»: كل قناة حفظها التاجر (الهاتف، واتساب، إنستجرام، فيسبوك، تيك توك، ماسنجر، البريد)
// ببطاقة وشعارها الرسمي، من مصدر واحد (lib/store-channels.ts). لا يظهر القسم إن لم توجد أي قناة.
import type { ReactNode } from "react";
import { Phone, Mail, MapPin } from "lucide-react";
import { SectionShell, SectionHeading } from "@/components/storefront/SectionShell";
import { BRAND_COLORS, BrandIcon } from "@/components/storefront/brand-icons";
import { socialLinks } from "@/lib/store-channels";
import type { Ctx } from "./_shared";
import type * as S from "@/blueprint/schema";

type ContactSection = ReturnType<typeof S.contactSection.parse> & {
  address?: string;
  subtitle?: string;
};

type Card = { key: string; icon: ReactNode; tint: string; title: string; value: string; href: string; ltr?: boolean; external?: boolean };

export function Contact({ s, ctx }: { s: ContactSection; ctx: Ctx }) {
  const channels = ctx.channels ?? {};
  const cards: Card[] = [
    ...(channels.phone
      ? [{ key: "phone", icon: <Phone className="size-5" strokeWidth={1.75} aria-hidden="true" />, tint: "var(--primary)", title: "اتصل بنا", value: channels.phone, href: `tel:${channels.phone}`, ltr: true }]
      : []),
    ...socialLinks(channels).map((l) => ({
      key: l.key,
      icon: <BrandIcon brand={l.key} className="size-5" />,
      tint: l.key === "tiktok" ? "var(--card-foreground)" : BRAND_COLORS[l.key],
      title: l.label,
      value: l.handle,
      href: l.href,
      ltr: true,
      external: true,
    })),
    ...(channels.email
      ? [{ key: "email", icon: <Mail className="size-5" strokeWidth={1.75} aria-hidden="true" />, tint: "var(--primary)", title: "البريد", value: channels.email, href: `mailto:${channels.email}`, ltr: true }]
      : []),
  ];
  if (!cards.length && !s.address) return null;

  return (
    <SectionShell s={s}>
      <SectionHeading
        title={s.title || "تواصل معنا"}
        subtitle={s.subtitle}
        sectionId={s.id}
      />
      <ul className="grid gap-3 sm:grid-cols-2" dir="rtl">
        {cards.map((c) => (
          <li key={c.key}>
            <a
              href={c.href}
              {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="flex items-center gap-3 rounded-3xl border p-5 shadow-xs transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2"
              style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--card-foreground)" }}
            >
              <span
                className="grid size-11 shrink-0 place-items-center rounded-2xl"
                style={{ background: `color-mix(in srgb, ${c.tint} 12%, transparent)`, color: c.tint }}
              >
                {c.icon}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black">{c.title}</p>
                <p dir={c.ltr ? "ltr" : undefined} className="mt-0.5 truncate text-end text-sm font-bold opacity-80 tabular-nums">
                  {c.value}
                </p>
              </div>
            </a>
          </li>
        ))}
      </ul>

      {s.address ? (
        <div
          className="mt-4 flex items-start gap-2.5 rounded-3xl border p-5 text-xs leading-relaxed"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--card-foreground)",
          }}
        >
          <MapPin
            className="mt-0.5 size-4 shrink-0"
            style={{ color: "var(--primary)" }}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span>{s.address}</span>
        </div>
      ) : null}
    </SectionShell>
  );
}