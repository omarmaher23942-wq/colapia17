import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dashboardLock, lockAllowsPath, storeVisibility } from "@/lib/store-visibility";

const DAY = 86_400_000;
const now = new Date("2026-10-19T10:00:00Z");

describe("المتجر المدفوع لا يُحذف أبداً", () => {
  const src = readFileSync("src/lifecycle/handlers.ts", "utf8");
  it("كل انتقال إلى deleted في المؤقتات ينطلق من حالات غير مدفوعة فقط", () => {
    const blocks = [...src.matchAll(/to:\s*"deleted"[\s\S]{0,200}?from:\s*\[([^\]]*)\]|from:\s*\[([^\]]*)\][\s\S]{0,200}?to:\s*"deleted"/g)];
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) expect(b[1] ?? b[2]).not.toMatch(/active/);
  });
});

describe("سلامة نقاط الدخول العامة (فحص مصدر)", () => {
  it("إجراء الدفع لصاحب المتجر وحده، والإيصال الواحد قيد المراجعة للمتجر مفروض بفهرس فريد", () => {
    const pay = readFileSync("src/server/actions/activation.ts", "utf8");
    expect(pay).toMatch(/ownerStore\(\{ allowLocked: true \}\)/);
    expect(pay).toMatch(/isTrustedUploadUrl\(input\.screenshotUrl\)/);
    const schema = readFileSync("src/db/schema/commerce.ts", "utf8");
    expect(schema).toMatch(/platform_payments_store_under_review_uq/);
  });
  it("حد استعمال كود الخصم ذري في القاعدة (قيد CHECK) فلا يتجاوزه طلبان متزامنان", () => {
    expect(readFileSync("src/db/schema/commerce.ts", "utf8")).toMatch(/used_count\} <= \$\{t\.maxUses\}|usedCount\} <= \$\{t\.maxUses\}/);
  });
  it("الوكيل لا يعالج رسالة بلا حراسة المخرج", () => {
    const rt = readFileSync("src/ai/agents/closer/runtime.ts", "utf8");
    expect(rt).toMatch(/reviewTurn\(turn/);
    expect(readFileSync("src/ai/agents/closer/review.ts", "utf8")).toMatch(/replyProblem\(turn\.reply/);
    expect(rt).toMatch(/isStaleBatch/);
  });
});
