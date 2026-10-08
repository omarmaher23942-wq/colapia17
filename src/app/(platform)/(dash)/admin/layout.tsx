// Owner sidebar — يضيف رابط /admin/reviews مع badge التقييمات غير المعتمدة.
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql, gt, inArray, and } from "drizzle-orm";
import {
  LayoutDashboard,
  Workflow,
  MessagesSquare,
  Wallet,
  UserPlus,
  Store,
  Activity,
  SlidersHorizontal,
  Users,
  LogOut,
  Star,
  Mail,
  type LucideIcon,
} from "lucide-react";
import { getPlatformSession } from "@/server/auth";
import { platformLogoutAction } from "@/server/actions/platform-auth";
import { db } from "@/db/client";
import {
  conversations,
  platformPayments,
  stores,
  platformReviews,
} from "@/db/schema";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";
import { cn } from "@/lib/utils";

const SW = 1.75;

const NAV: readonly (readonly [string, string, LucideIcon])[] = [
  ["/admin", "لوحة القيادة", LayoutDashboard],
  ["/admin/pipeline", "خط الإنتاج", Workflow],
  ["/admin/conversations", "المحادثات", MessagesSquare],
  ["/admin/payments", "التحويلات", Wallet],
  ["/admin/reviews", "المراجعات", Star],
  ["/admin/leads", "الليدز", UserPlus],
  ["/admin/audience", "الجمهور والبريد", Mail],
  ["/admin/stores", "المتاجر", Store],
  ["/admin/costs", "التكاليف", Activity],
  ["/admin/flags", "الإعدادات", SlidersHorizontal],
  ["/admin/team", "الفريق", Users],
];

const isActive = (path: string, href: string) =>
  href === "/admin"
    ? path === "/admin"
    : path === href || path.startsWith(`${href}/`);

const badgeText = (n: number) => (n > 99 ? "99+" : String(n));

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const u = await getPlatformSession();
  if (!u) redirect("/admin/login");

  const h = await headers();
  const path = (h.get("x-pathname") ?? "").toLowerCase();

  const [reviewRows, payRows, unreadRows, reviewsPendingRows] =
    await Promise.all([
      db
        .select({ review: sql<number>`count(*)`.mapWith(Number) })
        .from(stores)
        .where(inArray(stores.status, ["review", "building"]))
        .catch(() => [{ review: 0 }]),
      db
        .select({ pay: sql<number>`count(*)`.mapWith(Number) })
        .from(platformPayments)
        .where(eq(platformPayments.status, "under_review"))
        .catch(() => [{ pay: 0 }]),
      db
        .select({
          unread: sql<number>`coalesce(sum(unread_for_admin),0)`.mapWith(Number),
        })
        .from(conversations)
        .where(gt(conversations.unreadForAdmin, 0))
        .catch(() => [{ unread: 0 }]),
      db
        .select({ c: sql<number>`count(*)`.mapWith(Number) })
        .from(platformReviews)
        .where(eq(platformReviews.isApproved, false))
        .catch(() => [{ c: 0 }]),
    ]);

  const badge: Record<string, number> = {
    "/admin/pipeline": reviewRows[0]?.review ?? 0,
    "/admin/payments": payRows[0]?.pay ?? 0,
    "/admin/conversations": unreadRows[0]?.unread ?? 0,
    "/admin/reviews": reviewsPendingRows[0]?.c ?? 0,
  };

  const links = NAV.map(([href, label, Icon]) => ({
    href,
    label,
    Icon,
    active: isActive(path, href),
    count: badge[href] ?? 0,
  }));

  return (
    <div
      className="min-h-screen bg-[#07091a] font-sans text-[#eaf0ff]"
      dir="rtl"
      style={{ backgroundColor: "#07091a", color: "#eaf0ff" }}
    >
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-white/10 bg-[#090d24] md:flex">
          <div className="border-b border-white/10 p-5">
            <Link href="/admin" aria-label="Colapia">
              <ColapiaLogo size={32} priority />
            </Link>
            <p className="mt-2 text-xs font-bold text-[#8d97c4]">
              لوحة تحكم الأونر · {u.name}
            </p>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {links.map(({ href, label, Icon, active, count }) => (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all",
                  active
                    ? "border border-[#8fa8ff]/30 bg-[#6f86ff]/20 text-white shadow-sm"
                    : "text-[#c3cdf0]/70 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon
                  strokeWidth={SW}
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-[#8fa8ff]" : "text-[#8d97c4]"
                  )}
                  aria-hidden="true"
                />
                <span className="flex-1">{label}</span>
                {count > 0 ? (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-mono text-[10px] font-black",
                      href === "/admin/reviews"
                        ? "bg-amber-500 text-[#07091a]"
                        : "bg-[#6f86ff] text-[#07091a]"
                    )}
                  >
                    {badgeText(count)}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>

          <form action={platformLogoutAction} className="border-t border-white/10 p-3">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-start text-xs font-bold text-[#c3cdf0]/60 transition-colors hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut strokeWidth={SW} className="size-4" aria-hidden="true" />
              <span>تسجيل الخروج</span>
            </button>
          </form>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-[#07091a]">
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#07091a]/95 px-4 py-3 backdrop-blur-xl md:hidden">
            <ColapiaLogo size={28} />
            <form action={platformLogoutAction}>
              <button
                type="submit"
                aria-label="خروج"
                className="rounded-lg p-2 text-[#c3cdf0]/70 hover:bg-white/5"
              >
                <LogOut strokeWidth={SW} className="size-4" aria-hidden="true" />
              </button>
            </form>
          </div>
          <nav aria-label="أقسام لوحة المالك" className="sticky top-[53px] z-20 flex gap-1.5 overflow-x-auto border-b border-white/10 bg-[#07091a]/95 px-3 py-2 backdrop-blur-xl md:hidden">
            {links.map(({ href, label, active, count }) => (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-bold",
                  active ? "bg-[#6f86ff] text-white" : "bg-white/5 text-[#c3cdf0]/80"
                )}
              >
                {label}
                {count > 0 ? <span className="rounded-full bg-black/30 px-1.5 font-mono text-[10px]">{badgeText(count)}</span> : null}
              </Link>
            ))}
          </nav>
          <main className="min-w-0 flex-1 bg-[#07091a] p-4 md:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}