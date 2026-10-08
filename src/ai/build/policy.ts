// policy.ts — سياسات المتجر كما اختارها التاجر في الاستمارة، بصيغة الـ Blueprint.
// مصدر واحد يستخدمه التجميع (assemble) والحقائق (facts) وكاتب المحتوى، فلا تتناقض أبداً.
import type { StoreBlueprint } from "@/blueprint/schema";
import { storeFacts, type StoreFact } from "@/blueprint/facts";
import type { IntakeLike } from "./composer";

export type PolicySlices = Pick<StoreBlueprint, "payments" | "shipping" | "returns" | "channels">;

export function policySlices(intake: IntakeLike | undefined): PolicySlices {
  const pol = intake?.policies ?? {};
  const brief = intake?.brief ?? {};
  const vCash = Boolean(pol.vodafoneCashNumber?.trim());
  const instapay = Boolean(pol.instapayAddress?.trim());
  const days = pol.deliveryDays;
  const generalEta = pol.deliveryEta || (days?.min && days?.max ? `من ${days.min} إلى ${days.max} أيام عمل` : "من 2 إلى 5 أيام عمل");
  const returnDays = pol.returnDays ?? 14;

  const channels: StoreBlueprint["channels"] = {};
  if (brief.phone) channels.phone = brief.phone;
  if (brief.whatsappNumber) channels.whatsappNumber = brief.whatsappNumber;
  if (brief.email) channels.email = brief.email;
  if (brief.instagramHandle) channels.instagramUsername = brief.instagramHandle.slice(0, 80);
  if (brief.tiktokHandle) channels.tiktokUsername = brief.tiktokHandle.slice(0, 80);
  if (brief.facebookPageUrl && /^https?:\/\//.test(brief.facebookPageUrl)) channels.facebookUrl = brief.facebookPageUrl;

  return {
    payments: {
      cod: { enabled: pol.cod !== false },
      vodafoneCash: vCash ? { enabled: true, number: pol.vodafoneCashNumber } : { enabled: false },
      instapay: instapay ? { enabled: true, address: pol.instapayAddress } : { enabled: false },
      requireTransferProof: true,
    },
    shipping: {
      freeOverPiasters: typeof pol.freeShippingOverEgp === "number" && pol.freeShippingOverEgp >= 0 ? Math.round(pol.freeShippingOverEgp * 100) : null,
      flatRatePiasters: typeof pol.shippingFlatEgp === "number" && pol.shippingFlatEgp > 0 ? Math.round(pol.shippingFlatEgp * 100) : null,
      generalEta,
      pickupEnabled: Boolean(pol.pickupAddress?.trim()),
      ...(pol.pickupAddress?.trim() ? { pickupAddress: pol.pickupAddress.trim().slice(0, 200) } : {}),
      inspectionAllowed: pol.inspectionAllowed === true,
    },
    returns: {
      windowDays: Math.max(0, Math.min(60, Math.round(returnDays))),
      allowExchange: returnDays > 0 && (pol.allowExchange ?? true),
      allowRefund: returnDays > 0 && (pol.allowRefund ?? true),
      returnShippingPaidBy: pol.returnShippingPaidBy ?? "customer",
      refundDays: Math.max(1, Math.min(30, pol.refundDays ?? 7)),
      conditions: (pol.returnConditionsList ?? []).map((c) => c.trim().slice(0, 160)).filter(Boolean).slice(0, 8),
      ...(pol.nonReturnable?.trim() ? { nonReturnable: pol.nonReturnable.trim().slice(0, 300) } : {}),
      defectPolicy: pol.defectPolicy ?? "replace_or_refund",
      defectReportHours: Math.max(12, Math.min(720, Math.round(pol.defectReportHours ?? 48))),
      defectShippingByStore: pol.defectShippingByStore ?? true,
    },
    channels,
  };
}

/** عدد المحافظات المفعّلة وأسرع مدة توصيل كما أدخلها التاجر. */
export function coverageOf(intake: IntakeLike | undefined): { activeGovernorates: number; fastestDays?: number } {
  const zones = intake?.policies?.shippingZones;
  if (Array.isArray(zones) && zones.length) {
    const active = zones.filter((z) => z.active !== false);
    const fastest = active.map((z) => z.etaMaxDays ?? 0).filter((n) => n > 0);
    return { activeGovernorates: active.length, fastestDays: fastest.length ? Math.min(...fastest) : undefined };
  }
  return { activeGovernorates: 27, fastestDays: intake?.policies?.deliveryDays?.max };
}

/** حقائق المتجر من الاستمارة مباشرة (قبل وجود Blueprint). */
export function intakeFacts(intake: IntakeLike | undefined): StoreFact[] {
  const slices = policySlices(intake);
  return storeFacts({ ...slices } as StoreBlueprint, coverageOf(intake));
}
