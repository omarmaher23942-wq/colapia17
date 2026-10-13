// dashboard/size-guide — جداول المقاسات: تظهر في صفحة كل منتج له خيار مقاس، ومعها مساعد يقترح المقاس من الطول والوزن.
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { requireStoreArea, sessionPerms } from "@/server/merchant-guard";
import { allows } from "@/lib/store-perms";
import { getMerchantSession } from "@/server/auth";
import { getBlueprint } from "@/lib/tenant";
import { getTenantDb } from "@/db/tenant";
import { categories } from "@/db/schema";
import { NO_STORE_HREF } from "@/lib/edition";
import { SizeGuideEditor } from "@/components/dashboard/size-guide/SizeGuideEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "دليل المقاسات" };

export default async function SizeGuidePage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/size-guide");
  if (!session.store) redirect(NO_STORE_HREF);
  const access = await requireStoreArea("products");
  const [bp, cats] = await Promise.all([
    getBlueprint(session.store.id),
    getTenantDb(session.store.id).then((db) =>
      db.select({ id: categories.id, name: categories.name }).from(categories).where(and(eq(categories.storeId, session.store!.id))).orderBy(asc(categories.sortOrder))
    ),
  ]);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="border-b border-edge/10 pb-4">
        <h1 className="text-2xl font-black text-ink">دليل المقاسات</h1>
        <p className="mt-1 text-[13px] leading-6 text-ink-2">
          يظهر زر «دليل المقاسات» في صفحة كل منتج له خيار «مقاس»، ومعه مساعد يقترح المقاس من الطول والوزن متى كتبت مداهما لكل مقاس. أقل مرتجعات، وأسئلة «مقاسي إيه؟» أقل في الرسائل.
        </p>
      </header>
      <SizeGuideEditor initial={bp.sizeGuide} categories={cats} canEdit={allows(sessionPerms(access), "products", "manage")} />
    </div>
  );
}
