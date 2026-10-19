// Footer.tsx — تذييل المتجر (Core): هوية المتجر، أقسامه، خدمة العملاء (طلباتي والسياسات)، والتواصل.
// على الموبايل أعمدة الروابط أكورديون، وعلى الحاسوب مفتوحة. كل قناة تظهر مرة واحدة، والنصوص ≥13px بلا حروف كبيرة.
import Link from "next/link";
import { Phone, Banknote, Smartphone, Wallet, Mail } from "lucide-react";
import type { StoreBlueprint } from "@/blueprint/schema";
import type { StoreFact } from "@/blueprint/facts";
import { Icon } from "./Icon";
import { BRAND_COLORS, BrandIcon, type BrandKey } from "./brand-icons";
import { socialLinks } from "@/lib/store-channels";
import { FooterSection } from "./FooterSection";
import { waLink } from "@/lib/whatsapp";
import { StoreLogo } from "./StoreLogo";

const brandColor = (k: BrandKey) => (k === "tiktok" ? "var(--card-foreground)" : BRAND_COLORS[k]);
const SW = 1.75;

const POLICY_LINKS = [
  { href: "/pages/shipping", slug: "shipping", label: "سياسة الشحن" },
  { href: "/pages/returns", slug: "returns", label: "الاستبدال والاسترجاع" },
  { href: "/pages/privacy", slug: "privacy", label: "سياسة الخصوصية" },
  { href: "/pages/terms", slug: "terms", label: "الشروط والأحكام" },
] as const;
const POLICY_SLUGS = new Set<string>(POLICY_LINKS.map((p) => p.slug));
const digits = (v: string) => v.replace(/\D/g, "");

export function Footer({
  footer,
  brand,
  channels,
  pages,
  payments,
  categories,
  facts = [],
  scheme = "light",
}: {
  facts?: StoreFact[];
  scheme?: "light" | "dark" | "auto";
  footer: StoreBlueprint["footer"];
  brand: StoreBlueprint["brand"];
  channels: StoreBlueprint["channels"];
  pages: StoreBlueprint["pages"];
  payments: StoreBlueprint["payments"];
  categories: { id: string; name: string; slug: string }[];
}) {
  const year = new Date().getFullYear();
  const extraPages = pages.filter((p) => p.enabled && p.showInFooter && !POLICY_SLUGS.has(p.slug));
  const social = footer.showChannels ? socialLinks(channels) : [];
  const cats = categories.slice(0, 7);
  const wa = channels.whatsappNumber ? waLink(channels.whatsappNumber) : null;
  const samePhone = channels.phone && channels.whatsappNumber && digits(channels.phone) === digits(channels.whatsappNumber);
  const hasContact = Boolean(channels.phone || (wa && !samePhone) || channels.email);

  const linkCls = "inline-block py-1.5 text-[14px] font-medium transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:underline";

  return (
    <footer className="mt-20 border-t" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--card-foreground)" }} dir="rtl">
      <div className="container-x grid gap-x-10 gap-y-2 py-12 md:grid-cols-12 md:gap-y-10 md:py-14">
        <div className="space-y-4 pb-6 md:col-span-4 md:pb-0">
          <Link href="/" className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" aria-label={`${brand.name}: الرئيسية`}>
            <StoreLogo brand={brand} size="lg" scheme={scheme} />
          </Link>
          {footer.tagline || brand.tagline || brand.description ? <p className="max-w-md text-[14px] leading-relaxed opacity-80">{footer.tagline || brand.tagline || brand.description}</p> : null}
          {facts.length ? (
            <ul className="space-y-1.5 pt-1 text-[13px] font-bold opacity-90">
              {facts.slice(0, 3).map((f) => (
                <li key={f.key} className="flex items-center gap-2">
                  <Icon name={f.icon} className="size-4 shrink-0 text-[var(--primary)]" />
                  {f.title}
                </li>
              ))}
            </ul>
          ) : null}
          {social.length ? (
            <ul className="flex flex-wrap gap-2 pt-2" aria-label="حساباتنا">
              {social.map((l) => (
                <li key={l.key}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${l.label}: ${l.handle}`}
                    title={l.label}
                    className="grid size-11 place-items-center rounded-xl border transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2"
                    style={{ background: `color-mix(in srgb, ${brandColor(l.key)} 12%, transparent)`, borderColor: `color-mix(in srgb, ${brandColor(l.key)} 28%, transparent)`, color: brandColor(l.key) }}
                  >
                    <BrandIcon brand={l.key} className="size-5" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {cats.length ? (
          <FooterSection title="أقسام المتجر" className="md:col-span-3">
            <ul>
              {cats.map((c) => (
                <li key={c.id}>
                  <Link href={`/c/${encodeURIComponent(c.slug)}`} className={linkCls}>
                    {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/all" className={cn2(linkCls, "font-bold")}>
                  كل المنتجات
                </Link>
              </li>
            </ul>
          </FooterSection>
        ) : null}

        <FooterSection title="خدمة العملاء" className={cats.length ? "md:col-span-3" : "md:col-span-4"}>
          <ul>
            <li>
              <Link href="/track" className={linkCls}>
                طلباتي وتتبع الطلب
              </Link>
            </li>
            {POLICY_LINKS.filter((l) => pages.some((p) => p.slug === l.slug && p.enabled)).map((p) => (
              <li key={p.href}>
                <Link href={p.href} className={linkCls}>
                  {p.label}
                </Link>
              </li>
            ))}
            {extraPages.map((p) => (
              <li key={p.slug}>
                <Link href={`/pages/${p.slug}`} className={linkCls}>
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </FooterSection>

        {hasContact ? (
          <FooterSection title="تواصل معنا" className="md:col-span-2">
            <ul className="text-[14px] font-medium">
              {channels.phone ? (
                <li className="flex items-center gap-2 py-1.5">
                  <Phone className="size-4 shrink-0" strokeWidth={SW} aria-hidden="true" />
                  <a href={`tel:${channels.phone}`} dir="ltr" className="tabular-nums hover:opacity-70">
                    {channels.phone}
                  </a>
                </li>
              ) : null}
              {wa && !samePhone ? (
                <li className="flex items-center gap-2 py-1.5">
                  <BrandIcon brand="whatsapp" className="size-4 shrink-0" style={{ color: brandColor("whatsapp") }} />
                  <a href={wa} target="_blank" rel="noopener noreferrer" dir="ltr" className="tabular-nums hover:opacity-70">
                    {channels.whatsappNumber}
                  </a>
                </li>
              ) : null}
              {channels.email ? (
                <li className="flex min-w-0 items-center gap-2 py-1.5">
                  <Mail className="size-4 shrink-0" strokeWidth={SW} aria-hidden="true" />
                  <a href={`mailto:${channels.email}`} dir="ltr" className="min-w-0 truncate hover:opacity-70">
                    {channels.email}
                  </a>
                </li>
              ) : null}
            </ul>
          </FooterSection>
        ) : null}
      </div>

      <div className="border-t" style={{ borderColor: "var(--border)" }}>
        <div className="container-x flex flex-wrap items-center justify-between gap-3 py-5">
          <p className="text-[13px] font-medium opacity-70">
            © {year} {brand.name}. جميع الحقوق محفوظة.
          </p>
          {footer.showPaymentIcons && (payments.cod.enabled || payments.vodafoneCash.enabled || payments.instapay.enabled) ? (
            <ul className="flex flex-wrap gap-2 text-[13px] font-bold" aria-label="وسائل الدفع">
              {payments.cod.enabled ? <Pay icon={<Banknote className="size-4" strokeWidth={SW} aria-hidden="true" />} label="الدفع عند الاستلام" /> : null}
              {payments.vodafoneCash.enabled ? <Pay icon={<Smartphone className="size-4" strokeWidth={SW} aria-hidden="true" />} label="فودافون كاش" /> : null}
              {payments.instapay.enabled ? <Pay icon={<Wallet className="size-4" strokeWidth={SW} aria-hidden="true" />} label="إنستاباي" /> : null}
            </ul>
          ) : null}
        </div>
      </div>
    </footer>
  );
}

const cn2 = (...a: string[]) => a.join(" ");

function Pay({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
      {icon}
      {label}
    </li>
  );
}
