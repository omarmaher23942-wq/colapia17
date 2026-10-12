"use client";

// StorePixels — بكسلات الإعلانات التي يضعها التاجر من «التسويق»: ميتا وGA4 وتيك توك. المعرّفات تصل منقّاة من الخادم
// (`lib/tracking.ts`)، فلا نص حر في أي سكربت. أحداث المتجر (`window.clpTrack` في Analytics) تُترجم لأحداث كل منصة:
// زيارة الصفحة، مشاهدة منتج، إضافة للسلة، بدء الدفع، والشراء بمعرّف حدث = رقم الطلب (يمنع العد المزدوج مع الخادم).
import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import type { TrackingIds } from "@/lib/tracking";

type Fn = (...args: unknown[]) => void;
declare global {
  interface Window {
    clpPixel?: (name: string, props?: Record<string, unknown>) => void;
    fbq?: Fn;
    gtag?: Fn;
    ttq?: { page: Fn; track: Fn };
  }
}

const egp = (piasters: unknown) => (typeof piasters === "number" ? Math.round(piasters) / 100 : undefined);

function send(name: string, p: Record<string, unknown> = {}) {
  const { fbq, gtag, ttq } = window;
  const value = egp(p.price ?? p.total ?? p.value);
  const id = typeof p.productId === "string" ? p.productId : undefined;
  const item = id ? [{ item_id: id, item_name: p.name, price: egp(p.price), quantity: p.quantity ?? 1 }] : undefined;
  switch (name) {
    case "page_view":
      fbq?.("track", "PageView");
      ttq?.page();
      gtag?.("event", "page_view", { page_path: p.path });
      break;
    case "product_view":
      fbq?.("track", "ViewContent", { content_ids: id ? [id] : [], content_type: "product", content_name: p.name, value, currency: "EGP" });
      gtag?.("event", "view_item", { currency: "EGP", value, items: item });
      ttq?.track("ViewContent", { content_id: id, content_type: "product", content_name: p.name, value, currency: "EGP" });
      break;
    case "add_to_cart":
      fbq?.("track", "AddToCart", { content_ids: id ? [id] : [], content_type: "product", content_name: p.name, value, currency: "EGP" });
      gtag?.("event", "add_to_cart", { currency: "EGP", value, items: item });
      ttq?.track("AddToCart", { content_id: id, content_type: "product", content_name: p.name, quantity: p.quantity ?? 1, value, currency: "EGP" });
      break;
    case "begin_checkout":
      fbq?.("track", "InitiateCheckout", { value, currency: "EGP", num_items: p.items });
      gtag?.("event", "begin_checkout", { currency: "EGP", value });
      ttq?.track("InitiateCheckout", { value, currency: "EGP" });
      break;
    case "purchase": {
      const code = typeof p.code === "string" ? p.code : undefined;
      fbq?.("track", "Purchase", { value, currency: "EGP", content_type: "product", content_ids: p.productIds ?? [] }, code ? { eventID: code } : undefined);
      gtag?.("event", "purchase", { transaction_id: code, currency: "EGP", value });
      ttq?.track("CompletePayment", { value, currency: "EGP", content_type: "product" });
      break;
    }
  }
}

export function StorePixels({ ids }: { ids: TrackingIds }) {
  const path = usePathname();
  const any = Boolean(ids.metaPixelId || ids.gaMeasurementId || ids.tiktokPixelId);

  useEffect(() => {
    if (!any) return;
    window.clpPixel = send;
    return () => {
      delete window.clpPixel;
    };
  }, [any]);

  // زيارة كل صفحة (التنقل داخل المتجر لا يعيد تحميل الصفحة).
  useEffect(() => {
    if (any) send("page_view", { path });
  }, [any, path]);

  if (!any) return null;
  return (
    <>
      {ids.metaPixelId ? (
        <Script id="clp-meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${ids.metaPixelId}');fbq('track','PageView');`}
        </Script>
      ) : null}
      {ids.gaMeasurementId ? (
        <>
          <Script id="clp-ga4-src" src={`https://www.googletagmanager.com/gtag/js?id=${ids.gaMeasurementId}`} strategy="afterInteractive" />
          <Script id="clp-ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${ids.gaMeasurementId}',{send_page_view:false});gtag('event','page_view');`}
          </Script>
        </>
      ) : null}
      {ids.tiktokPixelId ? (
        <Script id="clp-tiktok" strategy="afterInteractive">
          {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${ids.tiktokPixelId}');ttq.page();}(window,document,'ttq');`}
        </Script>
      ) : null}
    </>
  );
}
