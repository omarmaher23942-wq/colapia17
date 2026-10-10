// الصفحة الرئيسية (Server Component):
// - تقرأ كوكي clp_m مباشرة (بدون استعلام DB) لضمان LCP سريع (مبدأ الأداء).
// - تجلب المراجعات المعتمدة عبر unstable_cache لتفادي ضرب الـ DB في كل طلب.
// - تسلّم session و reviews إلى Landing (مكوّن خادم؛ التفاعل في جزر صغيرة).
import { platformPricing } from "@/lib/platform-pricing";
import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { platformReviews } from "../../db/schema/platform";
import { Landing } from "../../components/landing/Landing";
import type { LandingReview, SessionState } from "../../components/landing/types";

const getApprovedReviews = unstable_cache(
  async (): Promise<LandingReview[]> => {
    try {
      const rows = await db
        .select({
          id: platformReviews.id,
          storeName: platformReviews.storeName,
          authorName: platformReviews.authorName,
          authorRole: platformReviews.authorRole,
          avatarUrl: platformReviews.avatarUrl,
          rating: platformReviews.rating,
          content: platformReviews.content,
        })
        .from(platformReviews)
        .where(and(eq(platformReviews.isApproved, true)))
        .orderBy(
          desc(platformReviews.isFeatured),
          desc(platformReviews.createdAt)
        )
        .limit(9);

      return rows;
    } catch {
      // في حال تعذّر الاتصال بقاعدة البيانات: حالة فارغة أنيقة — لا بيانات وهمية.
      return [];
    }
  },
  ["landing-approved-reviews"],
  { revalidate: 300, tags: ["platform-reviews"] }
);

async function getSessionState(): Promise<SessionState> {
  // فحص وجود كوكي فقط — لا نلمس DB في اللاندينج (الأمان الحقيقي في middleware
  // وفي صفحات /dashboard/* التي تستدعي getMerchantSession).
  const jar = await cookies();
  const token = jar.get("clp_m")?.value;
  return token && token.length >= 20 ? "merchant" : "guest";
}

export default async function Page() {
  const [reviews, session] = await Promise.all([
    getApprovedReviews(),
    getSessionState(),
  ]);

  const { price, basePrice, renewal } = platformPricing();

  const trialHours = Number(process.env.TRIAL_HOURS ?? 24) || 24;

  return <Landing session={session} reviews={reviews} pricing={{ price, basePrice, renewal }} trialHours={trialHours} />;
}