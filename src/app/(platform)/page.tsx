// الصفحة الرئيسية (Server Component):
// - تقرأ كوكي clp_m مباشرة (بدون استعلام DB) لضمان LCP سريع (مبدأ الأداء).
// - تجلب المراجعات المعتمدة من ذاكرة Redis (5 دقائق) لتفادي ضرب الـ DB في كل طلب (لا ذاكرة Next: تعمل على أي استضافة).
// - تسلّم session و reviews إلى Landing (مكوّن خادم؛ التفاعل في جزر صغيرة).
import { currentPricing } from "@/server/pricing";
import { lifecycleTimings } from "@/lifecycle/timings";
import { getFlag } from "@/lib/flags";
import { perYearFrom } from "@/lib/change-requests";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { cached } from "@/lib/redis";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { platformReviews } from "../../db/schema/platform";
import { Landing, landingFaq } from "../../components/landing/Landing";
import { planCards, instagramUrl } from "@/lib/landing-pricing";
import { demoUrl } from "@/agent/settings";
import { hostingGraceDays } from "@/server/hosting-grace";
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
const TITLE = "Colapia | متجر احترافي كامل لبراندكم يجهّزه فريقنا ويستضيفه";
const DESCRIPTION =
  "فريق Colapia يجهّز لبراندكم متجراً إلكترونياً احترافياً مع لوحة تحكم بالعربية، ويستضيفه ويشغّله: تجربة مجانية قبل الدفع، وطلبات بالدفع عند الاستلام وفودافون كاش وإنستاباي، وبلا عمولة على مبيعاتكم.";

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
  const [reviews, session] = await Promise.all([getApprovedReviews(), getSessionState()]);

  const [pricing, timings, changes, demo, grace] = await Promise.all([
    currentPricing(),
    lifecycleTimings(),
    getFlag<Record<string, unknown>>("change_requests").catch(() => ({ enabled: true, config: null })),
    demoUrl(),
    hostingGraceDays().catch(() => 3),
  ]);
  const plans = planCards(pricing);
  const igUrl = instagramUrl(process.env.NEXT_PUBLIC_INSTAGRAM_URL);
  const faq = landingFaq({ trialHours: timings.trialHours, graceDays: grace, plans });

  // بيانات منظمة صادقة: المنظمة والخدمة بباقاتها الفعلية الحالية، والأسئلة الشائعة.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${SITE}/#org`, name: "Colapia", url: SITE, logo: `${SITE}/logo.png` },
      {
        "@type": "Service",
        name: "متجر إلكتروني مجهّز مع استضافة وتشغيل",
        provider: { "@id": `${SITE}/#org` },
        areaServed: { "@type": "Country", name: "Egypt" },
        description: DESCRIPTION,
        offers: plans.map((p) => ({ "@type": "Offer", name: p.label, price: p.price, priceCurrency: "EGP", url: `${SITE}/#pricing` })),
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Landing
        session={session}
        reviews={reviews}
        plans={plans}
        trialHours={timings.trialHours}
        graceDays={grace}
        changesPerYear={perYearFrom(changes.config)}
        igUrl={igUrl}
        demoHref={demo}
      />
    </>
  );
}
