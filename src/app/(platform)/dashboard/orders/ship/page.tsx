// dashboard/orders/ship — «الشحن»: تصدير طلبات جاهزة بصيغة شركة الشحن، أرقام التتبع، وتسوية التحصيل عند الاستلام.
import { requireStoreArea } from "@/server/merchant-guard";
import { codDelivered, shipQueue } from "@/server/repos/ship";
import { ShipDesk, type ShipTab } from "@/components/dashboard/prep/ShipDesk";

export const dynamic = "force-dynamic";
export const metadata = { title: "الشحن" };

export default async function ShipPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const access = await requireStoreArea("orders");
  const sp = await searchParams;
  const tab: ShipTab = sp.tab === "shipped" ? "shipped" : sp.tab === "cod" ? "cod" : "ready";
  const [{ ready, shipped }, cod] = await Promise.all([shipQueue(access.store.id), tab === "cod" ? codDelivered(access.store.id) : Promise.resolve([])]);
  return <ShipDesk tab={tab} ready={ready} shipped={shipped} cod={cod} storeName={access.store.name} />;
}
