// roles.ts — أدوار فريق الوكالة وصلاحياتها (منطق خالص مختبَر، يستورده الخادم والواجهة معاً).
//
// القاعدة: الخادم يفرض الصلاحية في كل صفحة وكل إجراء (`can`)، والواجهة تُخفي ما لا يحق للعضو فقط. لا صلاحية
// تُستنتج من الواجهة. المالك وحده يدير الفريق والأسعار.
export const PLATFORM_ROLES = ["owner", "admin", "builder", "reviewer", "sales"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const ROLE_INFO: Record<PlatformRole, { label: string; hint: string }> = {
  owner: { label: "المالك", hint: "كل شيء، ومنه الفريق والأسعار والحذف النهائي." },
  admin: { label: "مدير", hint: "يدير الطلبات والمتاجر والمدفوعات ويسند العمل، ولا يدير الفريق." },
  builder: { label: "منفّذ", hint: "يبني المتاجر المسندة إليه: يعدّل بياناتها وينسخ البرومبت ويرسلها للمراجعة." },
  reviewer: { label: "مراجع", hint: "يراجع المتاجر قبل التسليم: يعتمدها أو يعيدها للمنفّذ بملاحظات." },
  sales: { label: "مبيعات", hint: "المحادثات والعملاء المحتملون، ويرى الطلبات ليرد على العملاء." },
};

/** ما يمكن فعله في لوحة الوكالة. */
export type Capability =
  | "requests.view_all" // يرى كل الطلبات (المنفّذ يرى المسند إليه فقط)
  | "requests.assign" // يسند منفّذاً ومراجعاً
  | "requests.work" // يعدّل البيانات وينقل بين مراحل البناء (للمسند إليه إن كان منفّذاً)
  | "requests.approve" // يعتمد المراجعة أو يعيدها
  | "requests.deliver" // يسلّم للعميل
  | "requests.client_stage" // ينقل المرحلة التي يراها العميل ويكتب له
  | "requests.spam"
  | "requests.delete"
  | "requests.note"
  | "stores.manage"
  | "payments.decide"
  | "conversations"
  | "leads"
  | "audience"
  | "costs"
  | "settings"
  | "pricing"
  | "team.manage";

const ALL: Capability[] = [
  "requests.view_all",
  "requests.assign",
  "requests.work",
  "requests.approve",
  "requests.deliver",
  "requests.client_stage",
  "requests.spam",
  "requests.delete",
  "requests.note",
  "stores.manage",
  "payments.decide",
  "conversations",
  "leads",
  "audience",
  "costs",
  "settings",
  "pricing",
  "team.manage",
];

const GRANTS: Record<PlatformRole, ReadonlySet<Capability>> = {
  owner: new Set(ALL),
  admin: new Set(ALL.filter((c) => c !== "team.manage" && c !== "pricing")),
  builder: new Set<Capability>(["requests.work", "requests.client_stage", "requests.note"]),
  reviewer: new Set<Capability>(["requests.view_all", "requests.approve", "requests.note"]),
  sales: new Set<Capability>(["requests.view_all", "requests.note", "requests.client_stage", "conversations", "leads"]),
};

export const isPlatformRole = (v: unknown): v is PlatformRole => typeof v === "string" && (PLATFORM_ROLES as readonly string[]).includes(v);

/** دور غير معروف (قيمة قديمة في القاعدة) = لا صلاحيات. */
export function can(role: string | null | undefined, cap: Capability): boolean {
  return isPlatformRole(role) ? GRANTS[role].has(cap) : false;
}

/** أدوار يستطيع المالك منحها لعضو (المالك لا يُمنح من اللوحة: يأتي من PLATFORM_OWNER_EMAILS أو التهيئة). */
export const ASSIGNABLE_ROLES = PLATFORM_ROLES.filter((r) => r !== "owner");

/** صفحات لوحة الوكالة وما تحتاجه كل صفحة (مصدر واحد للقائمة الجانبية وحراسة الصفحات). */
export const ADMIN_PAGES = {
  "/admin": "stores.manage", // غير المديرين يُحوَّلون إلى المحادثات (لوحة القيادة فيها أرقام مالية)
  "/admin/requests": null, // لوحة الإنتاج (المنفّذ يرى المسند إليه فقط)
  "/admin/edits": "requests.assign", // صندوق طلبات التعديل بعد التسليم
  "/admin/conversations": "conversations",
  "/admin/conversations/delivery": "conversations",
  "/admin/payments": "payments.decide",
  "/admin/reviews": "stores.manage",
  "/admin/leads": "leads",
  "/admin/briefs": "leads", // استمارات العملاء (العقارية وغيرها)
  "/admin/audience": "audience",
  "/admin/stores": "stores.manage",
  "/admin/costs": "costs",
  "/admin/pricing": "pricing",
  "/admin/flags": "settings",
  "/admin/launch": "settings", // جاهزية الإطلاق: فحص حي للخدمات والمفاتيح
  "/admin/team": null, // يراها الجميع (من في الفريق)، والإدارة للمالك
} as const satisfies Record<string, Capability | null>;

export type AdminPage = keyof typeof ADMIN_PAGES;

export function canSeePage(role: string | null | undefined, page: AdminPage): boolean {
  const need = ADMIN_PAGES[page];
  return need === null ? isPlatformRole(role) : can(role, need);
}
