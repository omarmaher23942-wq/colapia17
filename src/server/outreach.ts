import "server-only";
// outreach.ts — جمهور بريد المالك: كل من سجّل في المنصة، مصنّفاً حسب أين وصل.
//
// الشرائح (لكل تاجر أفضل حالة وصل إليها أي متجر له):
//   owned     استلم متجره على حساباته
//   paid      دفع ولم يستلم بعد
//   trial     متجره في التجربة أو قيد البناء
//   lapsed    انتهت تجربته دون دفع (مجمّد أو محذوف)
//   signed_up سجّل ولم يُكمل متجراً
import { createHmac } from "node:crypto";
import { desc, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { emailOptouts, merchants, stores } from "@/db/schema";
import { clientEnv, env } from "@/lib/env";

export const SEGMENTS = {
  all: "الكل",
  owned: "استلموا متاجرهم",
  paid: "دفعوا ولم يستلموا",
  trial: "في التجربة الآن",
  lapsed: "انتهت تجربتهم دون دفع",
  signed_up: "سجّلوا ولم يكملوا متجراً",
} as const;
export type Segment = keyof typeof SEGMENTS;
export type MerchantSegment = Exclude<Segment, "all">;

export type AudienceRow = {
  id: string;
  name: string;
  email: string;
  segment: MerchantSegment;
  storeName: string | null;
  subdomain: string | null;
  joinedAt: string;
  lastLoginAt: string | null;
  optedOut: boolean;
};

const RANK: Record<MerchantSegment, number> = { owned: 5, paid: 4, trial: 3, lapsed: 2, signed_up: 1 };

function segmentOf(s: { status: string; ownedAt: Date | null }): MerchantSegment {
  if (s.ownedAt) return "owned";
  if (s.status === "active") return "paid";
  if (s.status === "frozen" || s.status === "deleted") return "lapsed";
  if (["trial", "review", "building", "pending_review", "intake"].includes(s.status)) return "trial";
  return "signed_up";
}

export async function loadAudience(): Promise<AudienceRow[]> {
  const ms = await db
    .select({ id: merchants.id, name: merchants.displayName, email: merchants.email, createdAt: merchants.createdAt, lastLoginAt: merchants.lastLoginAt })
    .from(merchants)
    .where(isNotNull(merchants.email))
    .orderBy(desc(merchants.createdAt))
    .limit(20_000);
  if (!ms.length) return [];
  const [ss, outs] = await Promise.all([
    db
      .select({ merchantId: stores.merchantId, name: stores.name, subdomain: stores.subdomain, status: stores.status, ownedAt: stores.ownedAt })
      .from(stores)
      .where(inArray(stores.merchantId, ms.map((m) => m.id))),
    db.select({ email: emailOptouts.email }).from(emailOptouts),
  ]);
  const optedOut = new Set(outs.map((o) => o.email));
  const best = new Map<string, { seg: MerchantSegment; name: string; subdomain: string }>();
  for (const s of ss) {
    const seg = segmentOf(s);
    const cur = best.get(s.merchantId);
    if (!cur || RANK[seg] > RANK[cur.seg]) best.set(s.merchantId, { seg, name: s.name, subdomain: s.subdomain });
  }
  return ms
    .filter((m): m is typeof m & { email: string } => Boolean(m.email?.includes("@")))
    .map((m) => {
      const b = best.get(m.id);
      const email = m.email.trim().toLowerCase();
      return {
        id: m.id,
        name: m.name,
        email,
        segment: b?.seg ?? "signed_up",
        storeName: b?.name ?? null,
        subdomain: b?.subdomain ?? null,
        joinedAt: m.createdAt.toISOString(),
        lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
        optedOut: optedOut.has(email),
      };
    });
}

/** رابط إيقاف الرسائل: موقّع بالبريد، فلا يستطيع أحد إيقاف رسائل غيره. */
export function unsubscribeToken(email: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(`optout:${email.trim().toLowerCase()}`).digest("base64url").slice(0, 32);
}

export function unsubscribeUrl(email: string): string {
  const e = email.trim().toLowerCase();
  return `${clientEnv.NEXT_PUBLIC_APP_URL}/api/outreach/unsubscribe?e=${encodeURIComponent(e)}&t=${unsubscribeToken(e)}`;
}

/** {name} و{store} في نص الرسالة تُستبدل ببيانات كل مستلم. */
export function personalize(text: string, r: Pick<AudienceRow, "name" | "storeName">): string {
  const first = r.name.trim().split(/\s+/)[0] || r.name;
  return text.replaceAll("{name}", first).replaceAll("{store}", r.storeName ?? "متجرك");
}
