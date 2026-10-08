import "server-only";
import { headers } from "next/headers";
import { getMerchantStoreOrNull } from "@/server/auth";

export async function requireMerchantTenant() {
  const h = await headers();
  const subdomain = h.get("x-store-subdomain");
  if (!subdomain) {
    throw new Error("سياق المتجر غير موجود بالطلب");
  }

  const session = await getMerchantStoreOrNull();
  if (!session || session.store.subdomain.toLowerCase() !== subdomain.toLowerCase()) {
    throw new Error("غير مصرح: محاولة وصول غير مصرح بها للمتجر");
  }

  return session;
}