// GET /api/dashboard/search?q= — بحث لوحة الأوامر في طلبات المتجر ومنتجاته وعملائه.
import { NextResponse } from "next/server";
import { getMerchantStoreOrNull } from "@/server/auth";
import { sessionPerms } from "@/server/merchant-guard";
import { allows, type StoreArea } from "@/lib/store-perms";
import { dashboardSearch } from "@/server/repos/dashboard-search";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  const session = await getMerchantStoreOrNull();
  if (!session?.storeId) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    // نتائج ما يحق للعضو رؤيته فقط (طلبات/منتجات/عملاء).
    const perms = sessionPerms(session);
    const area: Record<string, StoreArea> = { order: "orders", product: "products", customer: "customers" };
    const hits = (await dashboardSearch(session.storeId, q)).filter((h) => allows(perms, area[h.kind] ?? "orders", "view"));
    return NextResponse.json({ hits }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
}
