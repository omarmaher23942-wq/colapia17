// dashboard/returns — طابور الاستبدال والاسترجاع وطلبات الإلغاء (مجال الطلبات).
import { requireStoreArea } from "@/server/merchant-guard";
import { returnsData } from "@/server/repos/returns-list";
import { ReturnsQueue, type ReturnsTab } from "@/components/dashboard/returns/ReturnsQueue";

export const dynamic = "force-dynamic";
export const metadata = { title: "الاستبدال والاسترجاع" };

export default async function ReturnsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const access = await requireStoreArea("orders");
  const sp = await searchParams;
  const tab: ReturnsTab = sp.tab === "cancel" ? "cancel" : sp.tab === "closed" ? "closed" : "open";
  const data = await returnsData(access.store.id, tab === "closed" ? "closed" : "open").catch(() => ({ returns: [], cancels: [], counts: { open: 0, cancel: 0 } }));
  return <ReturnsQueue tab={tab} returns={data.returns} cancels={data.cancels} counts={data.counts} storeName={access.store.name} />;
}
