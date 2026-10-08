// app/s/[store]/account/layout.tsx — غلاف حساب المشتري.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  User, Package, LogOut, ArrowLeft, Home, MapPin, Settings2,
} from "lucide-react";
import { requireStore } from "@/lib/tenant";
import { getCustomerSession } from "@/server/auth";
import { AccountSignOutButton } from "@/components/storefront/AccountSignOutButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "حسابي", template: "%s · حسابي" },
  robots: { index: false, follow: false },
};

const SW = 1.75;

type Props = {
  children: React.ReactNode;
  params: Promise<{ store: string }>;
};

export default async function AccountLayout({ children, params }: Props) {
  const { store: sub } = await params;
  const store = await requireStore(sub);
  const session = await getCustomerSession(store.id);

  const h = await headers();
  const pathname = (h.get("x-pathname") || "").toLowerCase();
  const isLoginRoute = pathname === "/account/login";

  if (!session && !isLoginRoute) {
    redirect("/account/login");
  }

  const NAV = [
    { href: "/account", label: "نظرة عامة", icon: Home },
    { href: "/account/orders", label: "طلباتي", icon: Package },
    { href: "/account/profile", label: "بياناتي", icon: User },
    { href: "/account/addresses", label: "عناويني", icon: MapPin },
    { href: "/account/settings", label: "الإعدادات", icon: Settings2 },
  ];

  return (
    <div className="container-x py-8 md:py-12" dir="rtl">
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside
          className="h-fit space-y-4 rounded-3xl border p-5 lg:sticky lg:top-24"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--card-foreground)",
          }}
        >
          {session ? (
            <div
              className="flex items-center gap-3 border-b pb-4"
              style={{ borderColor: "var(--border)" }}
            >
              {session.customer.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.customer.avatarUrl}
                  alt=""
                  className="size-11 rounded-full border object-cover"
                  style={{ borderColor: "var(--border)" }}
                />
              ) : (
                <span
                  className="grid size-11 place-items-center rounded-full border"
                  style={{ borderColor: "var(--border)" }}
                >
                  <User className="size-5" strokeWidth={SW} aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-black">
                  {session.customer.name}
                </p>
                {session.customer.email ? (
                  <p
                    className="truncate font-mono text-[11px] opacity-60"
                    dir="ltr"
                  >
                    {session.customer.email}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <nav aria-label="تنقل الحساب">
            <ul className="space-y-1">
              {NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors hover:bg-[var(--muted)]"
                    >
                      <Icon className="size-4" strokeWidth={SW} aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div
            className="border-t pt-4"
            style={{ borderColor: "var(--border)" }}
          >
            <Link
              href="/"
              className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold opacity-70 transition-opacity hover:opacity-100"
            >
              <ArrowLeft className="size-4" strokeWidth={SW} aria-hidden="true" />
              العودة للمتجر
            </Link>
            {session ? (
              <AccountSignOutButton
                storeSubdomain={store.subdomain}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-rose-500 transition-colors hover:bg-rose-500/10"
              >
                <LogOut className="size-4" strokeWidth={SW} aria-hidden="true" />
                تسجيل الخروج
              </AccountSignOutButton>
            ) : null}
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}