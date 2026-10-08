"use server";

import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, sql, and, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { merchants } from "@/db/schema/platform";
import { merchantReferrals, referralRewards } from "@/db/schema/growth";
import { getMerchantSession } from "@/server/auth";
import { createHash } from "node:crypto";

export async function generateMerchantReferralLinkAction() {
  try {
    const s = await getMerchantSession();
    if (!s) throw new Error("غير مصرح");

    // توليد كود إحالة فريد بناءً على الـ ID
    const hash = createHash("sha256").update(s.merchantId).digest("hex").slice(0, 8).toUpperCase();
    const referralCode = `CLP-${hash}`;
    const referralLink = `https://colapia.com/signup?ref=${referralCode}`;

    // جلب الإحصائيات
    const [stats] = await db
      .select({
        totalReferred: sql<number>`count(*)`.mapWith(Number),
        activeReferred: sql<number>`count(*) filter (where status = 'activated')`.mapWith(Number),
      })
      .from(merchantReferrals)
      .where(eq(merchantReferrals.referrerMerchantId, s.merchantId));

    const rewards = await db
      .select()
      .from(referralRewards)
      .where(eq(referralRewards.merchantId, s.merchantId))
      .orderBy(desc(referralRewards.createdAt));

    return { ok: true, data: { referralCode, referralLink, stats, rewards } };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "فشل جلب بيانات الإحالة" };
  }
}

export async function claimReferralRewardAction(rewardId: string) {
  try {
    const s = await getMerchantSession();
    if (!s) throw new Error("غير مصرح");

    const [reward] = await db
      .update(referralRewards)
      .set({ isClaimed: true, claimedAt: new Date() })
      .where(and(eq(referralRewards.id, rewardId), eq(referralRewards.merchantId, s.merchantId), eq(referralRewards.isClaimed, false)))
      .returning();

    if (!reward) throw new Error("المكافأة غير موجودة أو تم صرفها مسبقاً");

    revalidatePath("/dashboard/growth");
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: e instanceof Error ? e.message : "فشل صرف المكافأة" };
  }
}

export async function getReferralLeaderboardAction() {
  const session = await getMerchantSession();
  if (!session) return { ok: false, error: "غير مصرح" };
  try {
    const rows = await db
      .select({
        merchantId: merchants.id,
        merchantName: merchants.displayName,
        avatarUrl: merchants.avatarUrl,
        referralsCount: sql<number>`count(${merchantReferrals.id})`.mapWith(Number),
      })
      .from(merchantReferrals)
      .innerJoin(merchants, eq(merchants.id, merchantReferrals.referrerMerchantId))
      .where(eq(merchantReferrals.status, "activated"))
      .groupBy(merchants.id, merchants.displayName, merchants.avatarUrl)
      .orderBy(desc(sql`count(${merchantReferrals.id})`))
      .limit(10);

    // خصوصية التجار: الاسم الأول وأول حرف من الاسم الأخير فقط، والصورة لصاحب الجلسة وحده.
    const leaderboard = rows.map((r) => {
      const [first = "تاجر", second] = r.merchantName.trim().split(/\s+/);
      const isMe = r.merchantId === session.merchantId;
      return {
        merchantName: isMe ? r.merchantName : second ? `${first} ${second.charAt(0)}.` : first,
        avatarUrl: isMe ? r.avatarUrl : null,
        referralsCount: r.referralsCount,
      };
    });
    return { ok: true, data: leaderboard };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "فشل جلب لوحة الشرف" };
  }
}