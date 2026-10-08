// app/api/pusher/auth/route.ts — توقيع قنوات Pusher الخاصة.
//
// التعديلات الجذرية:
// 1) pusher-js v8 بـ authTransport:"ajax" يرسل الـ body كـ
//    application/x-www-form-urlencoded، وليس JSON. هذا الملف كان
//    يستخدم req.json() فقط، فكان يرمي 400 bad_json على كل طلب.
//    الآن نكتشف الـ Content-Type ونحوّل accordingly.
// 2) إذا كانت جلسة التاجر بلا storeId (حالة OAuth الحديث)، نستعلم
//    من قاعدة البيانات عن كل متاجر التاجر، بدل الاعتماد على storeId
//    الوحيد في الجلسة. هذا يضمن أن التاجر يشترك في قنوات كل متاجره.
//
// المبادئ الأمنية (بدون تغيير):
//  - التحقق من الجلسة (merchant / customer / platform).
//  - التحقق من أن المستخدم مصرّح له بالقناة المطلوبة.
//  - Rate limiting.
//  - لا نكشف أي معلومات للمستخدم غير المصرّح.
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { orders } from "@/db/schema";
import {
  getCustomerSession,
  getMerchantSession,
  getPlatformSession,
} from "@/server/auth";
import { authorizeChannel } from "@/lib/pusher-server";
import {
  canSubscribeToChannel,
  type ChannelAuthContext,
} from "@/server/realtime/events";
import { allow, clientIp } from "@/lib/ratelimit";
import { readRequestId } from "@/lib/correlation";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  socket_id: z.string().min(10).max(80),
  channel_name: z.string().min(1).max(200),
});

/**
 * pusher-js يُرسل الـ auth request بصيغة form-urlencoded عند استخدام
 * `authTransport: "ajax"` (الافتراضي). بعض العملاء قد يرسلون JSON إذا
 * استُخدم authTransport مخصص. ندعم الاثنين لضمان التوافق الكامل.
 */
async function parseAuthBody(req: Request): Promise<unknown> {
  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();

  // 1) Form-urlencoded (المسار الافتراضي في pusher-js)
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    return {
      socket_id: params.get("socket_id") ?? undefined,
      channel_name: params.get("channel_name") ?? undefined,
    };
  }

  // 2) JSON (لو استُخدم authTransport مخصص في المستقبل)
  if (contentType.includes("application/json")) {
    return await req.json();
  }

  // 3) Fallback: نحاول JSON ثم form-urlencoded
  const text = await req.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const params = new URLSearchParams(text);
    return {
      socket_id: params.get("socket_id") ?? undefined,
      channel_name: params.get("channel_name") ?? undefined,
    };
  }
}

export async function POST(req: Request) {
  const reqId = await readRequestId();
  const ip = clientIp(req.headers);

  // Rate limit: 120 اشتراك/دقيقة لكل IP.
  if (!(await allow("login", `pusher-auth:${ip}`))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await parseAuthBody(req);
  } catch (err) {
    log.warn(
      "auth",
      "pusher_auth_body_parse_failed",
      { reqId },
      String(err)
    );
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const { socket_id, channel_name } = parsed.data;

  // ─── محاولة كشف هوية المستخدم بالترتيب: platform → merchant → customer
  let ctx: ChannelAuthContext | null = null;

  const platformUser = await getPlatformSession();
  if (platformUser) {
    ctx = { kind: "platform", userId: platformUser.id };
  }

  if (!ctx) {
    const merchantSession = await getMerchantSession();
    if (merchantSession) {
      // قنوات كل المتاجر التي يملكها التاجر فعلاً (الملكية من stores.merchantId).
      const storeIds = merchantSession.stores.map((s) => s.id);

      ctx = {
        kind: "merchant",
        merchantId: merchantSession.merchantId,
        storeIds,
      };
    }
  }

  if (!ctx) {
    // المشتري: نستخرج storeId من اسم القناة presence-store-{id} أو private-store-{id}.
    const storeIdFromChannel = extractStoreIdFromChannel(channel_name);
    if (storeIdFromChannel) {
      const customerSession = await getCustomerSession(storeIdFromChannel);
      if (customerSession) {
        // أكواد طلبات المشتري في هذا المتجر فقط (قنوات private-order-{store}-{code}).
        const db = await getTenantDb(storeIdFromChannel);
        const orderCodes = await db
          .select({ code: orders.code })
          .from(orders)
          .where(
            and(
              eq(orders.storeId, storeIdFromChannel),
              eq(orders.customerId, customerSession.customerId)
            )
          )
          .limit(100);

        ctx = {
          kind: "customer",
          customerId: customerSession.customerId,
          storeId: storeIdFromChannel,
          orderCodes: orderCodes.map((o) => o.code),
        };
      }
    }
  }

  if (!ctx) {
    log.warn("auth", "pusher_auth_unauthenticated", { reqId }, channel_name);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ─── التحقق من صلاحية الوصول للقناة
  if (!canSubscribeToChannel(channel_name, ctx)) {
    log.warn(
      "auth",
      "pusher_auth_forbidden",
      {
        reqId,
        userId:
          ctx.kind === "platform"
            ? ctx.userId
            : ctx.kind === "merchant"
            ? ctx.merchantId
            : ctx.customerId,
      },
      `محاولة اشتراك غير مصرّح بها في ${channel_name}`
    );
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // ─── التوقيع
  const authData = authorizeChannel(
    socket_id,
    channel_name,
    ctx.kind === "merchant"
      ? {
          id: ctx.merchantId,
          name: undefined,
          avatarUrl: undefined,
        }
      : ctx.kind === "customer"
      ? { id: ctx.customerId }
      : { id: ctx.userId }
  );

  if (!authData) {
    log.error("auth", "pusher_auth_sign_failed", { reqId }, channel_name);
    return NextResponse.json({ error: "sign_failed" }, { status: 500 });
  }

  return NextResponse.json(authData);
}

function extractStoreIdFromChannel(channel: string): string | null {
  // presence-store-{uuid} أو private-store-{uuid} أو private-order-{uuid}-{code}
  const m = channel.match(/^(?:presence-store|private-store|private-order)-([0-9a-f-]{36})(?:-[A-Z0-9-]+)?$/i);
  return m?.[1] ?? null;
}