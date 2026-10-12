import { Fragment } from "react";
import { requireStore, getBlueprint } from "@/lib/tenant";
import { renderSection } from "@/blueprint/registry";
import { FrozenGate } from "@/components/storefront/FrozenGate";
import { getStoreFacts } from "@/server/repos/facts";
import { truthfulBlueprint } from "@/blueprint/facts";
import { createStoreKit } from "@/stores-kit/server";
import { loadSlot } from "@/stores/resolve";
import { isTeamPreview } from "@/server/store-preview";
import { storeJsonLd } from "@/lib/storefront-seo";
import { jsonLdString } from "@/lib/json-ld";

export default async function Home({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store: sub } = await params;
  const store = await requireStore(sub);

  if ((store.status === "frozen" || store.status === "intake" || store.status === "building") && !(await isTeamPreview())) {
    return <FrozenGate status={store.status} name={store.name} />;
  }

  const bp = await getBlueprint(store.id);
  const facts = await getStoreFacts(store.id, bp);
  const kit = createStoreKit({ store, bp: truthfulBlueprint(bp, facts), facts });
  const ctx = { storeId: store.id, channels: bp.channels, facts, copy: bp.copy, kit };

  const [nodes, HomeSlot] = await Promise.all([
    Promise.all(bp.home.map((s) => renderSection(s, ctx))),
    loadSlot(store.subdomain, "Home"),
  ]);

  // بيانات المتجر المنظمة لمحركات البحث (الاسم، الشعار، الحسابات، خانة البحث).
  const ld = <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(storeJsonLd(store, truthfulBlueprint(bp, facts))) }} />;

  // ترتيب الصفحة الرئيسية بكود المتجر الخاص إن وُجد (stores/<slug>/slots/Home.tsx)، وإلا بترتيب الـ Blueprint.
  if (HomeSlot)
    return (
      <>
        {ld}
        <HomeSlot kit={kit} sections={bp.home.map((section, i) => ({ section, node: nodes[i] }))} />
      </>
    );

  return (
    <>
      {ld}
      {nodes.map((node, i) => (
        <Fragment key={(bp.home[i] as { id?: string }).id ?? i}>{node}</Fragment>
      ))}
    </>
  );
}