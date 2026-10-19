import "server-only";
// handoff-data.ts — بيانات رسائل التسليم لمتجر بعينه (للخادم وحده): رابط الإعداد الموقّع، صفحة الدخول، رابط المتجر الحقيقي،
// وبريد التاجر. تستخدمها صفحة المحادثة وقائمة «بانتظار التسليم» وإجراء الإرسال عبر الرسائل.
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { merchants, stores } from "@/db/schema";
import { env } from "@/lib/env";
import { publicStoreUrl } from "@/lib/utils";
import { setupLink } from "./tokens";
import type { HandoffInput } from "./handoff-messages";

export const platformOrigin = () => {
  const root = (env.ROOT_DOMAIN || "").trim();
  return !root || root.startsWith("localhost") ? "http://localhost:3100" : `https://${root}`;
};

export type HandoffData = HandoffInput & { status: string; subdomain: string; linkSentAt: string | null };

type Row = {
  id: string;
  name: string;
  status: string;
  subdomain: string;
  customDomain: string | null;
  customDomainStatus: string | null;
  onboarding: unknown;
  email: string | null;
};

/** من صف متجر (مع بريد صاحبه) إلى بيانات رسائل التسليم. */
export function handoffFromRow(row: Row): HandoffData {
  const sent = (row.onboarding as Record<string, unknown> | null)?.linkSentAt;
  return {
    storeName: row.name,
    setupUrl: setupLink(row.id),
    loginUrl: `${platformOrigin()}/login`,
    storeUrl: publicStoreUrl(row),
    email: row.email ?? null,
    status: row.status,
    subdomain: row.subdomain,
    linkSentAt: typeof sent === "string" ? sent : null,
  };
}

export const handoffColumns = {
  id: stores.id,
  name: stores.name,
  status: stores.status,
  subdomain: stores.subdomain,
  customDomain: stores.customDomain,
  customDomainStatus: stores.customDomainStatus,
  onboarding: stores.onboarding,
  email: merchants.email,
};

export async function handoffInputFor(storeId: string): Promise<HandoffData | null> {
  const [row] = await db.select(handoffColumns).from(stores).leftJoin(merchants, eq(merchants.id, stores.merchantId)).where(eq(stores.id, storeId)).limit(1);
  return row ? handoffFromRow(row) : null;
}
