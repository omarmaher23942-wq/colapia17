// abandoned.ts — متى تُعدّ السلة «متروكة»: صاحبها ترك بياناته ولم يُتم طلباً، ومرّت عليه مدة كافية ليُحتمل أنه لن يعود.
// قبل ذلك هو ما زال يكتب بيانات الدفع، فلا نزعج التاجر بسلة حية.
export const ABANDON_AFTER_MIN = 45;

export function isAbandonedCart(cart: { lastSeenAt: Date | string | number; recoveredOrderId?: string | null }, now = Date.now(), afterMin = ABANDON_AFTER_MIN): boolean {
  if (cart.recoveredOrderId) return false;
  const seen = cart.lastSeenAt instanceof Date ? cart.lastSeenAt.getTime() : new Date(cart.lastSeenAt).getTime();
  if (!Number.isFinite(seen)) return false;
  return now - seen >= afterMin * 60_000;
}

/** حد الزمن لاستعلام SQL: كل سلة آخر نشاط لها قبل هذا الوقت تُعدّ متروكة. */
export const abandonedBefore = (now = Date.now(), afterMin = ABANDON_AFTER_MIN) => new Date(now - afterMin * 60_000);
