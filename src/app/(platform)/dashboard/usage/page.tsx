// dashboard/usage — حدود الاستخدام الشهرية والمتبقي منها (مجال الإعدادات).
import { requireStoreArea } from "@/server/merchant-guard";
import { usageSummary } from "@/server/usage";
import { UsageMeters } from "@/components/dashboard/usage/UsageMeters";

export const dynamic = "force-dynamic";
export const metadata = { title: "الاستخدام" };

export default async function UsagePage() {
  const access = await requireStoreArea("settings");
  const u = await usageSummary(access.store.id);
  return <UsageMeters u={u} />;
}
