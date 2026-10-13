// dashboard/domain — نطاقك الخاص: اكتب نطاقك، أضف السجلات عند شركة النطاق، وتابع الحالة حية.
import { redirect } from "next/navigation";
import { getMerchantSession } from "@/server/auth";
import { isStoreOwner, requireStoreArea } from "@/server/merchant-guard";
import { NO_STORE_HREF } from "@/lib/edition";
import { dnsRecordsFor, explainDns } from "@/lib/custom-domain";
import { domainAutoConfigured, domainTarget, lookupDns } from "@/server/domains";
import { storeUrl } from "@/lib/utils";
import { DomainPanel } from "@/components/dashboard/domain/DomainPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "نطاقك الخاص" };

export default async function DomainPage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/domain");
  if (!session.storeId || !session.store) redirect(NO_STORE_HREF);
  const s = await requireStoreArea("settings");
  const store = session.store;
  const domain = store.customDomain;
  const target = domainTarget();
  const dns = domain && store.customDomainStatus !== "active" ? await lookupDns(domain) : null;
  return (
    <div className="mx-auto max-w-3xl">
      <DomainPanel
        canEdit={isStoreOwner(s)}
        subdomainUrl={storeUrl(store.subdomain)}
        domain={domain}
        status={(store.customDomainStatus as "pending" | "awaiting_team" | "active" | null) ?? null}
        checkedAt={store.customDomainCheckedAt?.toISOString() ?? null}
        records={domain ? dnsRecordsFor(domain, target) : []}
        explain={domain ? (store.customDomainStatus === "active" ? "متجرك يعمل على نطاقك، ورابطك القديم يحوّل إليه تلقائياً." : store.customDomainStatus === "awaiting_team" ? "النطاق يشير إلينا. فريقنا يكمل ربطه من جهتنا، وسيعمل خلال ساعات." : explainDns(domain, dns, target)) : null}
        allowed={["trial", "active"].includes(store.status)}
        auto={domainAutoConfigured()}
        apexNeedsCname={target.kind === "cloudflare"}
      />
    </div>
  );
}
