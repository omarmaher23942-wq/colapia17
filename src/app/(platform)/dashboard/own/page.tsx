// /dashboard/own — "امتلك متجرك": نقل المتجر ولوحة التحكم إلى حسابات التاجر (GitHub + Vercel + Neon).
import type { Metadata } from "next";
import { requireMerchantStore } from "@/server/auth";
import { githubEnabled } from "@/server/ownership/github";
import { latestTransfer } from "@/server/ownership/transfer";
import { OwnershipCenter } from "@/components/dashboard/own/OwnershipCenter";
import { ownWindow } from "@/lib/ownership-window";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "امتلك متجرك" };

export default async function OwnPage({ searchParams }: { searchParams: Promise<{ github?: string; message?: string }> }) {
  const s = await requireMerchantStore();
  const q = await searchParams;
  const t = await latestTransfer(s.storeId);
  const w = ownWindow(s.store);
  return (
    <OwnershipCenter
      storeName={s.store.name}
      subdomain={s.store.subdomain}
      active={s.store.status === "active"}
      githubEnabled={githubEnabled()}
      repo={s.store.ownedRepo}
      github={{ state: q.github ?? null, message: q.message ?? null }}
      purgeAfter={s.store.purgeAfter?.toISOString() ?? null}
      purgedAt={s.store.purgedAt?.toISOString() ?? null}
      deadline={w.phase === "open" || w.phase === "overdue" ? { at: w.deadline.toISOString(), purgeAt: w.purgeAt.toISOString(), overdue: w.phase === "overdue" } : null}
      live={{
        transfer: t ? { status: t.status, siteUrl: t.siteUrl, lastSeenAt: t.lastSeenAt?.toISOString() ?? null, expiresAt: t.expiresAt.toISOString() } : null,
        ownedUrl: s.store.ownedUrl,
        ownedAt: s.store.ownedAt?.toISOString() ?? null,
      }}
    />
  );
}
