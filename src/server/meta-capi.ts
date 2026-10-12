import "server-only";
// meta-capi.ts — يرسل حدث «شراء» لميتا من الخادم (Conversions API) بنفس معرّف الحدث الذي يرسله البكسل في المتصفح
// (رقم الطلب)، فتحسب ميتا الشراء مرة واحدة حتى لو حجب المتصفح البكسل. بيانات العميل تُجزّأ بـ SHA-256 كما تشترط ميتا.
// لا يُرسل شيء إن لم يضع التاجر معرّف البكسل ورمز الواجهة، ولا للطلبات التجريبية.
import { createHash } from "node:crypto";
import { e164Egypt } from "@/lib/tracking";

const GRAPH = "https://graph.facebook.com/v21.0";
const h = (v: string | null | undefined) => (v ? createHash("sha256").update(v.trim().toLowerCase()).digest("hex") : undefined);

export type CapiPurchase = {
  pixelId: string;
  token: string;
  orderCode: string;
  totalPiasters: number;
  contentIds: string[];
  numItems: number;
  phone: string;
  email?: string | null;
  name: string;
  city?: string | null;
  externalId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  url: string;
  at: Date;
};

export function capiPurchasePayload(p: CapiPurchase) {
  const [fn, ...rest] = p.name.trim().split(/\s+/);
  return {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(p.at.getTime() / 1000),
        event_id: p.orderCode,
        action_source: "website",
        event_source_url: p.url,
        user_data: {
          ph: [h(e164Egypt(p.phone) ?? p.phone.replace(/\D/g, ""))],
          em: p.email ? [h(p.email)] : undefined,
          fn: fn ? [h(fn)] : undefined,
          ln: rest.length ? [h(rest.join(" "))] : undefined,
          ct: p.city ? [h(p.city.replace(/\s+/g, ""))] : undefined,
          country: [h("eg")],
          external_id: p.externalId ? [h(p.externalId)] : undefined,
          client_ip_address: p.ip || undefined,
          client_user_agent: p.userAgent || undefined,
          fbp: p.fbp || undefined,
          fbc: p.fbc || undefined,
        },
        custom_data: { currency: "EGP", value: p.totalPiasters / 100, content_ids: p.contentIds, content_type: "product", num_items: p.numItems, order_id: p.orderCode },
      },
    ],
  };
}

/** يعيد true إن قبلتها ميتا. الفشل لا يمس الطلب (يُسجَّل فقط). */
export async function sendCapiPurchase(p: CapiPurchase): Promise<boolean> {
  try {
    const r = await fetch(`${GRAPH}/${encodeURIComponent(p.pixelId)}/events?access_token=${encodeURIComponent(p.token)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(capiPurchasePayload(p)),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.error("[capi] rejected", r.status, (await r.text().catch(() => "")).slice(0, 300));
    return r.ok;
  } catch (e) {
    console.error("[capi] failed", e);
    return false;
  }
}
