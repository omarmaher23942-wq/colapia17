import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// كل صفحة في لوحة التاجر تتحقق من صلاحية مجالها بنفسها (المرحلة 6)، وكل إجراء تاجر يحصل على المتجر عبر الحارس.
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// no-access: صفحة الرفض نفسها. store/[id]: تعرض متجراً يملكه التاجر فقط (شرط stores.merchant_id في الاستعلام).
// setup-pending: وجهة تحويل موظف متجر قيد الإعداد (لا تستدعي requireStoreArea لأنه هو من يحوّل إليها).
const PUBLIC_PAGES = ["no-access", "store/[id]", "setup-pending", "edit", "history"];

describe("فرض صلاحيات فريق التاجر", () => {
  it("كل page.tsx تحت dashboard تستدعي requireStoreArea", () => {
    const pages = walk("src/app/(platform)/dashboard").filter((f) => f.endsWith("page.tsx") && !PUBLIC_PAGES.some((p) => f.includes(`/${p}/`)) && !/onboarding/.test(f));
    const missing = pages.filter((f) => !/requireStoreArea\(/.test(readFileSync(f, "utf8")));
    expect(missing).toEqual([]);
  });
  it("إجراءات التاجر لا تستخدم جلسة المتجر الخام بلا صلاحية", () => {
    const actions = walk("src/server/actions").filter((f) => f.endsWith(".ts"));
    const raw = actions.filter((f) => /getMerchantStoreOrNull\(\)|requireMerchantStore\(\)/.test(readFileSync(f, "utf8")));
    expect(raw).toEqual([]);
  });
});
