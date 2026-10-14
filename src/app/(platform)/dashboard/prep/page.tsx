// dashboard/prep — «غرفة التجهيز»: صفحة لوحة خاصة بمتجر نور للملابس وحده (components/dashboard/store-extras.ts).
// أي متجر آخر يفتح الرابط يحصل على 404. البيانات: server/repos/store-extras/prep-room.ts.
import { notFound } from "next/navigation";
import { requireStoreArea } from "@/server/merchant-guard";
import { hasStoreExtra } from "@/components/dashboard/store-extras";
import { prepRoomData, type PrepScope } from "@/server/repos/store-extras/prep-room";
import { PrepRoom, type PrepTab } from "@/components/dashboard/store-extras/PrepRoom";

export const dynamic = "force-dynamic";
export const metadata = { title: "غرفة التجهيز" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PrepPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requireStoreArea("orders");
  if (!hasStoreExtra(access.store.subdomain, "prep")) notFound();
  const sp = await searchParams;
  const tab: PrepTab = one(sp.tab) === "pack" ? "pack" : one(sp.tab) === "sizes" ? "sizes" : "pick";
  const scope: PrepScope = one(sp.scope) === "all" ? "all" : "ready";
  const days = one(sp.days) === "90" ? 90 : 30;
  const data = await prepRoomData(access.store.id, scope, days);
  return <PrepRoom data={data} tab={tab} scope={scope} />;
}
