// dashboard/team — فريق المتجر: صاحب المتجر يدعو موظفين بالبريد بأدوار أو صلاحيات مخصصة، وسجل نشاط الفريق.
import { redirect } from "next/navigation";
import { and, desc, eq, ne } from "drizzle-orm";
import { getMerchantSession } from "@/server/auth";
import { requireStoreArea } from "@/server/merchant-guard";
import { db } from "@/db/client";
import { merchants, storeActivity, storeMembers } from "@/db/schema";
import { NO_STORE_HREF } from "@/lib/edition";
import { TeamPanel } from "@/components/dashboard/team/TeamPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "فريق المتجر" };

export default async function TeamPage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/team");
  if (!session.storeId || !session.store) redirect(NO_STORE_HREF);
  await requireStoreArea("team", "manage");
  const [members, activity] = await Promise.all([
    db
      .select({ m: storeMembers, lastLogin: merchants.lastLoginAt })
      .from(storeMembers)
      .leftJoin(merchants, eq(merchants.id, storeMembers.merchantId))
      .where(and(eq(storeMembers.storeId, session.storeId), ne(storeMembers.status, "removed")))
      .orderBy(desc(storeMembers.createdAt)),
    db
      .select({ a: storeActivity, name: merchants.displayName })
      .from(storeActivity)
      .leftJoin(merchants, eq(merchants.id, storeActivity.merchantId))
      .where(eq(storeActivity.storeId, session.storeId))
      .orderBy(desc(storeActivity.createdAt))
      .limit(30),
  ]);
  return (
    <div className="mx-auto max-w-4xl">
      <TeamPanel
        storeName={session.store.name}
        members={members.map(({ m, lastLogin }) => ({ id: m.id, email: m.email, name: m.name, role: m.role, perms: m.perms ?? null, joined: Boolean(m.merchantId), lastLogin: lastLogin?.toISOString() ?? null }))}
        activity={activity.map(({ a, name }) => ({ id: a.id, who: name ?? "—", action: a.action, target: a.target, at: a.createdAt.toISOString() }))}
      />
    </div>
  );
}
