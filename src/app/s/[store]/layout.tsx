import type { Metadata, Viewport } from "next";
import { allPolicyPages } from "@/blueprint/policy-pages";
import { headers } from "next/headers";
import { requireStore, getBlueprintOrNull, getStoreBySubdomain } from "@/lib/tenant";
import { storeMetadata, storeViewport } from "@/lib/storefront-seo";
import { themeStyleSheet } from "@/blueprint/theme";
import { designStyleSheet } from "@/blueprint/design";
import { getStoreFacts } from "@/server/repos/facts";
import { truthfulBlueprint } from "@/blueprint/facts";
import { AnnouncementBar } from "@/components/storefront/AnnouncementBar";
import { BottomBar } from "@/components/storefront/BottomBar";
import { migrateToCore } from "@/blueprint/core-migrate";
import { cardStyleOf } from "@/blueprint/themes";
import { schemeOf } from "@/blueprint/tokens";
import { CardFx } from "@/components/storefront/CardFx";
import { StoreProvider } from "@/components/storefront/StoreProvider";
import { EditorProvider } from "@/editor/EditorProvider";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { CartDrawer } from "@/components/storefront/CartDrawer";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PromoFromLink } from "@/components/storefront/PromoFromLink";
import { ConversionWidgets } from "@/components/storefront/ConversionWidgets";
import { Analytics } from "@/components/storefront/Analytics";
import { StorePixels } from "@/components/storefront/StorePixels";
import { trackingFrom } from "@/lib/tracking";
import { FrozenGate } from "@/components/storefront/FrozenGate";
import { hostingState } from "@/lib/hosting";
import { storeVisibility, gateShowsName } from "@/lib/store-visibility";
import { OwnerFirstImpressionBanner } from "@/components/storefront/OwnerFirstImpressionBanner";
import { listVisibleCategories } from "@/server/repos/catalog";
import { notFound } from "next/navigation";
import { createStoreKit } from "@/stores-kit/server";
import { loadSlot, storeTheme } from "@/stores/resolve";
import { isTeamPreview } from "@/server/store-preview";
import { hostingGraceDays } from "@/server/hosting-grace";

type Props = {
  children: React.ReactNode;
  params: Promise<{ store: string }>;
};

/** هوية المتجر نفسه في العنوان والأيقونة و Open Graph — لا أي أثر لهوية المنصة. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ store: string }>;
}): Promise<Metadata> {
  const { store: sub } = await params;
  const store = await getStoreBySubdomain(sub);
  if (!store) return { robots: { index: false, follow: false } };
  const bp = await getBlueprintOrNull(store.id);
  const meta = storeMetadata(store, bp ? truthfulBlueprint(bp, await getStoreFacts(store.id, bp)) : null);
  // أيقونة التبويب تتبع شعار المتجر: رقم إصدار من رابط الشعار يُجبر المتصفح على جلب الجديدة فور تغييره
  // (المتصفحات تحتفظ بالأيقونة القديمة طويلاً لنفس الرابط).
  const mark = bp?.brand.favicon ?? bp?.brand.logo?.url ?? "";
  if (mark) {
    let h = 0;
    for (let i = 0; i < mark.length; i++) h = (h * 31 + mark.charCodeAt(i)) | 0;
    const icon = `/api/storefront/icon?v=${(h >>> 0).toString(36)}`;
    meta.icons = { icon, shortcut: icon, apple: icon };
  }
  return meta;
}

export async function generateViewport({
  params,
}: {
  params: Promise<{ store: string }>;
}): Promise<Viewport> {
  const { store: sub } = await params;
  const store = await getStoreBySubdomain(sub);
  return storeViewport(store ? await getBlueprintOrNull(store.id) : null);
}

export default async function StoreLayout({ children, params }: Props) {
  const { store: sub } = await params;
  const store = await requireStore(sub);
  const h = await headers();
  const pathname = (h.get("x-pathname") || "").toLowerCase();

  // مسارات إدارية لها layouts خاصة (لا Header/Footer عليها).
  const isAdminRoute =
    pathname === "/admin" || pathname.startsWith("/admin/");
  // صفحة التقييم صارت بهوية المتجر (رأسه وتذييله) كأي صفحة فيه.
  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900">
        {children}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // بوابة الحالات: نتحقق قبل تحميل الـ blueprint.
  // هذا يمنع 404 لو المتجر قيد البناء (blueprint قد يكون غير موجود).
  // ═════════════════════════════════════════════════════════════════════
  const hosting = hostingState(store, new Date(), await hostingGraceDays().catch(() => undefined));
  const visibility = storeVisibility(store, hosting);
  const gated = !visibility.public;
  // الفريق يرى المتجر خلف البوابة (نشرة معاينة بـ ?store=، أو مفتاح المعاينة على نطاقه) لمراجعته قبل التسليم.
  const teamPreview = await isTeamPreview();
  if (gated && !teamPreview) {
    return (
      <div className="min-h-dvh bg-[#f8fafc] text-slate-900">
        <FrozenGate status={visibility.gate ?? "paused"} name={gateShowsName(visibility.gate) ? store.name : undefined} />
      </div>
    );
  }

  // من هنا، status إما trial | active
  const [rawBp, categories] = await Promise.all([
    getBlueprintOrNull(store.id),
    listVisibleCategories(store.id),
  ]);

  // دفاع أخير: لو الـ blueprint غير موجود لأي سبب (بيانات تالفة).
  if (!rawBp) {
    notFound();
  }

  // النصوص الحرة (الوصف وشعار الفوتر) تُعرض بعد حذف أي ادعاء لم يعد صحيحاً في سياسة المتجر الآن.
  const facts = await getStoreFacts(store.id, rawBp);
  const bp = migrateToCore(truthfulBlueprint(rawBp, facts));
  // الأقسام الفارغة لا تظهر في أي مكان (القائمة والتذييل).
  const navCategories = categories.filter((c) => c.productCount > 0);

  // تخصيصات هذا المتجر من مستودع المتاجر (stores/<slug>/): الجلد، والهيدر والفوتر إن كتبهما فريق البناء.
  const kit = createStoreKit({ store, bp, facts });
  const [HeaderSlot, FooterSlot] = await Promise.all([loadSlot(store.subdomain, "Header"), loadSlot(store.subdomain, "Footer")]);
  const theme = storeTheme(store.subdomain);
  const cardStyle = cardStyleOf(bp);

  const coreHeader = <Header header={bp.header} brand={bp.brand} categories={navCategories} channels={bp.channels} />;
  const coreFooter = (
    <Footer
      footer={bp.footer}
      brand={bp.brand}
      channels={bp.channels}
      pages={allPolicyPages(bp)}
      payments={bp.payments}
      categories={navCategories}
      facts={facts}
      scheme={schemeOf(bp.theme)}
    />
  );

  return (
    <StoreProvider
      value={{
        storeId: store.id,
        subdomain: store.subdomain,
        brand: bp.brand,
        conversion: bp.conversion,
        channels: bp.channels,
        payments: bp.payments,
        shipping: bp.shipping,
        acceptingOrders: store.acceptingOrders,
        vacationMessage: store.vacationMessage,
        copy: bp.copy,
        design: bp.design,
        cardStyle: bp.theme.productCardStyle,
        facts,
        sizeGuide: bp.sizeGuide,
        scheme: schemeOf(bp.theme),
      }}
    >
      <EditorProvider>
        <style
          dangerouslySetInnerHTML={{
            // الثيم (ألوان وخطوط) ثم نظام التصميم الخاص بالمتجر ثم جلده المنقّى.
            __html: themeStyleSheet(bp.theme, ".storefront") + designStyleSheet(bp, ".storefront"),
          }}
        />
        {theme ? <style data-store-theme dangerouslySetInnerHTML={{ __html: theme }} /> : null}

        <OwnerFirstImpressionBanner
          subdomain={store.subdomain}
          storeName={store.name}
        />

        <div
          className="storefront flex min-h-dvh flex-col"
          data-button-style={bp.theme.buttonStyle}
          data-card-style={bp.theme.productCardStyle}
          data-card={cardStyle}
          data-design={bp.design.theme}
          data-theme-mode={bp.theme.mode}
          data-motion={bp.design.motion.level}
          data-depth={bp.design.motion.depth ? "on" : "off"}
        >
          <CardFx style={cardStyle} />
          {teamPreview ? (
            <p role="status" className="fixed bottom-3 start-3 z-[60] rounded-full bg-amber-400 px-3 py-1.5 text-[12px] font-bold text-amber-950 shadow-lg" data-team-preview>
              معاينة الفريق{gated ? " — لا يراه العملاء بعد" : ""}
            </p>
          ) : null}
          {!store.acceptingOrders ? (
            // وضع الإجازة: يعرفه الزائر من أول صفحة، لا عند الدفع بعد أن يملأ سلته.
            <p role="status" className="s-announce px-4 py-2 text-center text-[13px] font-bold">
              {store.vacationMessage || "المتجر لا يستقبل طلبات الآن، وسنعود قريباً"}
            </p>
          ) : null}
          {bp.header.announcement ? <AnnouncementBar ann={bp.header.announcement} /> : null}
          {HeaderSlot ? <HeaderSlot kit={kit} core={coreHeader} /> : coreHeader}

          <main className="flex-1">{children}</main>

          {FooterSlot ? <FooterSlot kit={kit} core={coreFooter} /> : coreFooter}

          {bp.header.bottomBar ? <BottomBar hasCategories={navCategories.length > 0} /> : null}
          <CartDrawer />
          <InstallPrompt
            variant="store"
            storeId={store.id}
            storeName={bp.brand.name || store.name}
            logoUrl={bp.brand.logo?.url}
            disabled={teamPreview || gated}
          />
          <PromoFromLink subdomain={store.subdomain} />
          <ConversionWidgets />
          {/* بكسلات التاجر لا تعمل في معاينة الفريق (لا نلوّث إحصاءات إعلاناته بزياراتنا). */}
          {teamPreview ? null : <StorePixels ids={trackingFrom(bp.seo)} />}
          <Analytics storeId={store.id} />
        </div>
      </EditorProvider>
    </StoreProvider>
  );
}