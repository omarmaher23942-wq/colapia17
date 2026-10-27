// inbox.ts — صندوق المالك: كل ما ينتظر إجراءً من الفريق في قائمة واحدة مرتبة (خالص ومختبَر).
export const INBOX_KINDS = ["payment", "booking", "other_service", "edit_request", "human", "followup"] as const;
export type InboxKind = (typeof INBOX_KINDS)[number];

export const INBOX_KIND_INFO: Record<InboxKind, { label: string; href: string; weight: number }> = {
  payment: { label: "إيصال دفع", href: "/admin/payments", weight: 100 },
  booking: { label: "حجز جديد", href: "/admin/requests", weight: 90 },
  other_service: { label: "خدمة أخرى", href: "/admin/conversations?filter=other_service", weight: 80 },
  human: { label: "عميل يطلب موظفاً", href: "/admin/conversations?filter=human", weight: 70 },
  edit_request: { label: "طلب تعديل", href: "/admin/edits", weight: 60 },
  followup: { label: "متابعة مستحقة", href: "/admin/conversations?filter=followup", weight: 50 },
};

export type InboxItem = { id: string; kind: InboxKind; title: string; detail?: string; at: Date; href?: string };

/** الأقدم انتظاراً أولاً داخل النوع الأعلى وزناً؛ ويرتفع ما انتظر أكثر من 24 ساعة. */
export function sortInbox(items: InboxItem[], now: number): InboxItem[] {
  const score = (i: InboxItem) => INBOX_KIND_INFO[i.kind].weight + (now - i.at.getTime() > 24 * 3600_000 ? 15 : 0);
  return [...items].sort((a, b) => score(b) - score(a) || a.at.getTime() - b.at.getTime());
}

export function inboxCounts(items: InboxItem[]): Record<InboxKind, number> {
  const out = Object.fromEntries(INBOX_KINDS.map((k) => [k, 0])) as Record<InboxKind, number>;
  for (const i of items) out[i.kind]++;
  return out;
}

export const inboxHref = (i: InboxItem) => i.href ?? INBOX_KIND_INFO[i.kind].href;

/** عناصر لا تظهر لدور لا يملك صلاحيتها. */
export const INBOX_CAP: Record<InboxKind, "payments.decide" | "requests.view_all" | "conversations" | "stores.manage"> = {
  payment: "payments.decide",
  booking: "requests.view_all",
  other_service: "conversations",
  human: "conversations",
  edit_request: "stores.manage",
  followup: "conversations",
};
