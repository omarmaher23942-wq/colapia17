// قاعدة المالك (2026-10-13، CLAUDE.md 6.1): النصوص المرئية تخاطب أي شخص. هذا الحارس يرفض صيغ المؤنث الحصرية وعامية
// المذكر الصريحة في ما يراه زائر المتجر والتاجر (المتجر، الهبوط، الاستمارة، المتابعة، البريد، النصوص الافتراضية).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = [
  "src/components/storefront",
  "src/components/blocks",
  "src/components/landing",
  "src/components/auth",
  "src/app/s",
  "src/app/(platform)/setup",
  "src/app/(platform)/no-store",
  "src/app/(platform)/login",
  "src/app/(platform)/terms",
  "src/app/(platform)/privacy",
  "src/lib/email-templates",
  "src/blueprint/defaults.ts",
  "src/blueprint/copy.ts",
  "src/blueprint/facts.ts",
  "src/blueprint/schema.ts",
  "src/lib/order-messages.ts",
  "src/lib/checkout-form.ts",
  "src/lib/order-requests.ts",
  "src/lib/payment-methods.ts",
  "src/lib/pricing",
  "src/server/actions/checkout.ts",
  "src/server/actions/order-requests.ts",
  "src/server/cart-check.ts",
  "src/agent/setup-messages.ts",
  "src/agent/lead.ts",
  "src/agent/state.ts",
  "src/lifecycle/templates.ts",
  "src/lifecycle/handlers.ts",
  "src/components/dashboard/billing",
  "src/components/onboarding",
  "src/components/dashboard/design",
  "src/components/dashboard/products/ImportTool.tsx",
  "src/app/(platform)/onboarding",
  "src/app/(platform)/dashboard/design",
  "src/app/(platform)/dashboard/setup-pending",
  "src/app/(platform)/dashboard/products/import",
  "src/lib/onboarding.ts",
  "src/lib/design-tweak.ts",
  "src/lib/import-candidates.ts",
  "src/server/usage.ts",
  "src/components/dashboard/prep",
  "src/components/dashboard/returns",
  "src/components/dashboard/questions",
  "src/components/dashboard/studio",
  "src/components/dashboard/usage",
  "src/components/dashboard/overview/GoalCard.tsx",
  "src/components/dashboard/overview/ShareStoreCard.tsx",
  "src/components/dashboard/products/BulkEditor.tsx",
  "src/components/dashboard/OnboardingTour.tsx",
  "src/components/dashboard/PathBanners.tsx",
  "src/components/dashboard/nav.ts",
  "src/components/dashboard/settings/OrderAlertsCard.tsx",
  "src/app/(platform)/dashboard/orders/prep",
  "src/app/(platform)/dashboard/orders/ship",
  "src/app/(platform)/dashboard/returns",
  "src/app/(platform)/dashboard/questions",
  "src/app/(platform)/dashboard/studio",
  "src/app/(platform)/dashboard/usage",
  "src/app/(platform)/dashboard/products/bulk",
  "src/app/print/labels",
  "src/lib/returns.ts",
  "src/lib/studio.ts",
  "src/lib/sales-goal.ts",
  "src/lib/usage-limits.ts",
  "src/lib/courier-export.ts",
  "src/lib/cod-reconcile.ts",
  "src/lib/bulk-edit.ts",
  "src/lib/order-notify.ts",
  "src/server/actions/returns.ts",
  "src/server/actions/questions.ts",
  "src/server/actions/studio.ts",
  "src/server/actions/shipping-ops.ts",
  "src/server/actions/bulk-products.ts",
  "src/server/actions/growth.ts",
  "src/server/design-tweak.ts",
  "src/server/import",
  "src/server/actions/setup.ts",
  "src/server/actions/setup-import.ts",
  "src/server/actions/design.ts",
  "src/lib/pdp.ts",
  "src/lib/collection-filters.ts",
  "src/lib/card-ui.ts",
  "src/server/actions/product-page.ts",
  "src/server/actions/collection.ts",
  "src/blueprint/core-migrate.ts",
  "src/blueprint/core-palette.ts",
  "src/blueprint/registry.tsx",
];

// كلمات كاملة (لا أجزاء كلمات): مؤنث حصري، وعامية مذكر صريحة.
const BANNED = [
  "دوّري", "دوري", "ابحثي", "جرّبي", "جربي", "اختاري", "الصقي", "صوّري", "ارفعي", "افتحي", "اطلبيه", "اطلبي", "اسألي", "كلّمي",
  "شوفي", "اكتشفي", "تسوقي", "تسوّقي", "العميلة", "عميلتك", "عايزة", "حبيبتي",
  "عايز", "معاك", "استنى", "سيبها", "متأكد", "هتضيفها", "هتشوفها", "يا بطل", "يا باشا", "يا معلم",
];

function files(p: string): string[] {
  const st = statSync(p);
  if (st.isFile()) return /\.(tsx?|json)$/.test(p) ? [p] : [];
  return readdirSync(p).flatMap((n) => files(join(p, n)));
}

const AR = "\\u0600-\\u06FF";
const word = (w: string) => new RegExp(`(^|[^${AR}])${w}(?=$|[^${AR}])`);

describe("لغة تشمل الجميع", () => {
  it("لا صيغ مؤنث حصرية ولا عامية مذكر صريحة في النصوص المرئية", () => {
    const hits: string[] = [];
    for (const f of ROOTS.flatMap(files)) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // التعليقات للفريق لا للعميل
          for (const w of BANNED) if (word(w).test(line)) hits.push(`${f}:${i + 1} «${w}»`);
        });
    }
    expect(hits).toEqual([]);
  });
});
