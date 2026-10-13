// الصفحة الرئيسية (Server Component):
// - تقرأ كوكي clp_m مباشرة (بدون استعلام DB) لضمان LCP سريع (مبدأ الأداء).
// - تجلب المراجعات المعتمدة من ذاكرة Redis (5 دقائق) لتفادي ضرب الـ DB في كل طلب (لا ذاكرة Next: تعمل على أي استضافة).
// - تسلّم session و reviews إلى Landing (مكوّن خادم؛ التفاعل في جزر صغيرة).
import { currentPricing } from "@/server/pricing";
import { lifecycleTimings } from "@/lifecycle/timings";
import { getFlag } from "@/lib/flags";
import { perMonthFrom } from "@/lib/change-requests";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { cached } from "@/lib/redis";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { platformReviews } from "../../db/schema/platform";
import { Landing } from "../../components/landing/Landing";
import type { LandingReview, SessionState } from "../../components/landing/types";

const getApprovedReviews = () =>
  cached("landing:reviews", 300, async (): Promise<LandingReview[]> => {
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
  });

const SITE = `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "colapia.com"}`;
const TITLE = "Colapia | متجر إلكتروني لبراندك، يبنيه فريقنا ويستضيفه";
const DESCRIPTION =
  "فريق Colapia يبني لبراندك متجراً إلكترونياً مخصصاً ويستضيفه: تجربة مجانية قبل الدفع، طلبات بالدفع عند الاستلام وفودافون كاش وإنستاباي، ولوحة تحكم بالعربي، وبلا عمولة على مبيعاتك.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: SITE },
  openGraph: { type: "website", locale: "ar_EG", url: SITE, siteName: "Colapia", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

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

  const [{ price, renewal }, timings, changes] = await Promise.all([
    currentPricing(),
    lifecycleTimings(),
    getFlag<Record<string, unknown>>("change_requests").catch(() => ({ enabled: true, config: null })),
  ]);

  // بيانات منظمة صادقة: المنظمة والخدمة بسعرها الحالي الفعلي من سلّم الأسعار.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${SITE}/#org`, name: "Colapia", url: SITE, logo: `${SITE}/logo.png` },
      {
        "@type": "Service",
        name: "متجر إلكتروني مخصص مع سنة استضافة",
        provider: { "@id": `${SITE}/#org` },
        areaServed: { "@type": "Country", name: "Egypt" },
        description: DESCRIPTION,
        offers: { "@type": "Offer", price, priceCurrency: "EGP", url: `${SITE}/start` },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Landing session={session} reviews={reviews} pricing={{ price, renewal }} trialHours={timings.trialHours} changesPerMonth={perMonthFrom(changes.config)} />
    </>
  );
}