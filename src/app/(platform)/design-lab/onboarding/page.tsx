// معمل التصميم: تجربة البناء السريعة ببيانات تجريبية (تطوير فقط؛ الحفظ يفشل لعدم وجود قاعدة).
import { notFound } from "next/navigation";
import { OnboardingWizard } from "@/app/(platform)/onboarding/[token]/wizard/OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingLab({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { step } = await searchParams;
  return (
    <OnboardingWizard
      token="design-lab"
      draftVersion={0}
      lastStep={step ?? "store"}
      expiresAt={new Date(Date.now() + 86_400_000).toISOString()}
      draft={{
        store: { storeName: "بيت الأناقة", desiredSubdomain: "beit-elanaqa", industry: "fashion", phone: "01012345678" },
        products: {
          sections: [],
          products: [
            { id: "a", name: "فستان سهرة ستان", priceEgp: 1450, compareAtEgp: 1900, images: [{ id: "i1", url: "https://picsum.photos/seed/dress/600/600" }], primaryImageId: "i1" },
            { id: "b", name: "حقيبة يد جلد", priceEgp: 890, images: [{ id: "i2", url: "https://picsum.photos/seed/bag/600/600" }], primaryImageId: "i2" },
            { id: "c", name: "", priceEgp: 0, images: [{ id: "i3", url: "https://picsum.photos/seed/shoe/600/600" }], primaryImageId: "i3" },
          ],
        },
      }}
    />
  );
}
