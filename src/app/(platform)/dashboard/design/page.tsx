// dashboard/design — «شكل المتجر»: التصميم (الثمانية والألوان والخطوط والبطاقة والخلفية)، الهوية (شعار وألوان وخطوط)، واجهة المتجر (فيديو/صورة)، شريط الإعلان، ترتيب أقسام الرئيسية،
// حقل «اكتبوا ما تريدون تغييره»، وسجل نسخ التصميم للاستعادة. بجانبها معاينة حية للمتجر.
import { requireStoreArea } from "@/server/merchant-guard";
import { loadBlueprint } from "@/server/setup-data";
import { designHistory } from "@/server/design-tweak";
import { pairIdFor } from "@/lib/onboarding";
import { SECTION_LABELS } from "@/lib/design-tweak";
import { publicStoreUrl } from "@/lib/utils";
import { allows } from "@/lib/store-perms";
import { StoreLookPage } from "@/components/dashboard/design/StoreLookPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "شكل المتجر" };

export default async function DesignPage() {
  const session = await requireStoreArea("content");
  const store = session.store;
  const bp = await loadBlueprint(store.id);
  if (!bp) return null;
  const history = await designHistory(store.id, 12);

  const hero = bp.home.find((s) => s.type === "hero");
  const ann = bp.home.find((s) => s.type === "announcement");
  const url = publicStoreUrl(store);

  return (
    <StoreLookPage
      storeUrl={url}
      canEdit={allows(session.perms, "content", "manage")}
      identity={{ name: bp.brand.name, primary: bp.theme.palette.primary, fontPair: pairIdFor(bp.theme.fonts.heading, bp.theme.fonts.body), logoUrl: bp.brand.logo?.url ?? null }}
      heroKind={hero && hero.type === "hero" ? (hero.videoUrl ? "video" : hero.images.length ? "image" : "auto") : "auto"}
      announcement={{ text: ann && ann.type === "announcement" ? (ann.messages[0]?.text ?? "") : "", enabled: Boolean(ann && ann.enabled !== false) }}
      sections={bp.home.filter((s) => s.type !== "hero" && s.type !== "announcement").map((s) => ({ id: s.id, label: SECTION_LABELS[s.type] ?? s.type, enabled: s.enabled !== false }))}
      motion={bp.design.motion}
      history={history}
      look={{ theme: bp.theme, design: bp.design }}
    />
  );
}
