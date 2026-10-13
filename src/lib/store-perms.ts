// store-perms.ts — صلاحيات فريق التاجر في لوحة متجره (منطق خالص مختبَر، مشترك مع مشروع التاجر المستقل).
//
// صاحب المتجر (stores.merchant_id) يملك كل شيء دائماً. كل عضو يدعوه يأخذ دوراً جاهزاً أو صلاحيات مخصصة: لكل مجال
// مستوى «لا شيء / عرض / إدارة». الخادم يفرضها في كل صفحة وإجراء (server/merchant-guard.ts)، والواجهة تُخفي فقط.
export const STORE_AREAS = ["orders", "products", "customers", "discounts", "shipping", "content", "analytics", "reviews", "settings", "team", "billing", "requests"] as const;
export type StoreArea = (typeof STORE_AREAS)[number];

export const ACCESS_LEVELS = ["none", "view", "manage"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export type StorePerms = Record<StoreArea, AccessLevel>;

export const AREA_LABEL: Record<StoreArea, string> = {
  orders: "الطلبات",
  products: "المنتجات والأقسام والمخزون",
  customers: "العملاء",
  discounts: "الخصومات والحملات",
  shipping: "الشحن",
  content: "المحتوى والتصميم والصفحات",
  analytics: "التحليلات والتصدير والنظرة العامة",
  reviews: "التقييمات",
  settings: "الإعدادات والدفع والتواصل",
  team: "فريق المتجر",
  billing: "الاشتراك والفواتير",
  requests: "طلبات التعديل للوكالة",
};

export const LEVEL_LABEL: Record<AccessLevel, string> = { none: "لا شيء", view: "عرض", manage: "إدارة" };

const all = (level: AccessLevel): StorePerms => Object.fromEntries(STORE_AREAS.map((a) => [a, level])) as StorePerms;

export const OWNER_PERMS: StorePerms = all("manage");
export const NO_PERMS: StorePerms = all("none");

export const STORE_ROLES = ["manager", "orders", "products", "marketing", "accountant", "custom"] as const;
export type StoreRole = (typeof STORE_ROLES)[number];

export const STORE_ROLE_INFO: Record<Exclude<StoreRole, "custom">, { label: string; hint: string; perms: StorePerms }> = {
  manager: {
    label: "مدير المتجر",
    hint: "كل شيء عدا الفريق والاشتراك.",
    perms: { ...OWNER_PERMS, team: "none", billing: "none" },
  },
  orders: {
    label: "موظف طلبات",
    hint: "يدير الطلبات، ويرى العملاء والمنتجات.",
    perms: { ...NO_PERMS, orders: "manage", customers: "view", products: "view" },
  },
  products: {
    label: "محرر منتجات",
    hint: "المنتجات والأقسام والمخزون والتقييمات والمحتوى.",
    perms: { ...NO_PERMS, products: "manage", reviews: "manage", content: "manage" },
  },
  marketing: {
    label: "مسوّق",
    hint: "الخصومات والمحتوى والتحليلات.",
    perms: { ...NO_PERMS, discounts: "manage", content: "manage", analytics: "view" },
  },
  accountant: {
    label: "محاسب",
    hint: "يرى الطلبات والتحليلات والعملاء فقط.",
    perms: { ...NO_PERMS, orders: "view", analytics: "view", customers: "view" },
  },
};

export const STORE_ROLE_LABEL: Record<StoreRole, string> = {
  ...Object.fromEntries(Object.entries(STORE_ROLE_INFO).map(([k, v]) => [k, v.label])),
  custom: "صلاحيات مخصصة",
} as Record<StoreRole, string>;

/** صلاحيات عضو من دوره (أو المخصصة المحفوظة للدور custom). أي قيمة تالفة = لا شيء. */
export function permsFor(role: string, custom?: unknown): StorePerms {
  if (role !== "custom" && role in STORE_ROLE_INFO) return STORE_ROLE_INFO[role as Exclude<StoreRole, "custom">].perms;
  const c = (custom && typeof custom === "object" ? custom : {}) as Record<string, unknown>;
  const out = { ...NO_PERMS };
  for (const a of STORE_AREAS) {
    const v = c[a];
    if (v === "view" || v === "manage") out[a] = v;
  }
  // الفريق والاشتراك لا يُمنحان لعضو: صاحب المتجر وحده (يُنقل بطلب للوكالة).
  out.team = "none";
  out.billing = "none";
  return out;
}

const RANK: Record<AccessLevel, number> = { none: 0, view: 1, manage: 2 };

export function allows(perms: StorePerms | null | undefined, area: StoreArea, level: Exclude<AccessLevel, "none"> = "view"): boolean {
  if (!perms) return false;
  return RANK[perms[area] ?? "none"] >= RANK[level];
}

/** أول مجال يستطيع العضو رؤيته (لتحويله إليه حين يفتح صفحة لا يملكها). */
export function firstAllowedArea(perms: StorePerms): StoreArea | null {
  return STORE_AREAS.find((a) => allows(perms, a, "view")) ?? null;
}

/** صفحة اللوحة لكل مجال (للتحويل والقائمة). */
export const AREA_HREF: Record<StoreArea, string> = {
  orders: "/dashboard/orders",
  products: "/dashboard/products",
  customers: "/dashboard/customers",
  discounts: "/dashboard/discounts",
  shipping: "/dashboard/shipping",
  content: "/dashboard/content",
  analytics: "/dashboard",
  reviews: "/dashboard/reviews",
  settings: "/dashboard/settings",
  team: "/dashboard/team",
  billing: "/dashboard/billing",
  requests: "/dashboard/requests",
};

/** مجال كل مسار في اللوحة (أطول بادئة تطابق). /dashboard نفسها = النظرة العامة (analytics). */
const PATH_AREAS: [string, StoreArea][] = [
  ["/dashboard/orders", "orders"],
  ["/dashboard/products", "products"],
  ["/dashboard/categories", "products"],
  ["/dashboard/size-guide", "products"],
  ["/dashboard/customers", "customers"],
  ["/dashboard/discounts", "discounts"],
  ["/dashboard/growth", "discounts"],
  ["/dashboard/marketing", "discounts"],
  ["/dashboard/shipping", "shipping"],
  ["/dashboard/content", "content"],
  ["/dashboard/design", "content"],
  ["/dashboard/policies", "settings"],
  ["/dashboard/domain", "settings"],
  ["/dashboard/analytics", "analytics"],
  ["/dashboard/reviews", "reviews"],
  ["/dashboard/settings", "settings"],
  ["/dashboard/team", "team"],
  ["/dashboard/billing", "billing"],
  ["/dashboard/own", "billing"],
  ["/dashboard/store", "billing"],
  ["/dashboard/requests", "requests"],
];

export function areaForPath(path: string): StoreArea | null {
  const p = path.split("?")[0]!.replace(/\/$/, "");
  if (p === "/dashboard") return "analytics";
  for (const [prefix, area] of PATH_AREAS) if (p === prefix || p.startsWith(`${prefix}/`)) return area;
  return null;
}
