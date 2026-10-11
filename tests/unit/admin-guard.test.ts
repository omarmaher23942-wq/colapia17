import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// طلب RSC مصنوع (Next-Router-State-Tree) يعرض الصفحة دون تشغيل تخطيط admin، فالتحقق من الجلسة في التخطيط وحده
// لا يحمي شيئاً. كل صفحة أو مسار تحت admin يجب أن يتحقق بنفسه.
const ROOT = "src/app/(platform)/(dash)/admin";
const GUARD = /requirePlatformPage|platformUser\(|getPlatformSession\(/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("حراسة لوحة المالك", () => {
  it("كل page.tsx وroute.ts تحت admin يتحقق من جلسة المنصة بنفسه", () => {
    const entries = walk(ROOT).filter((f) => /(^|[\\/])(page\.tsx|route\.ts)$/.test(f));
    expect(entries.length).toBeGreaterThan(10);
    const unguarded = entries.filter((f) => !GUARD.test(readFileSync(f, "utf8")));
    expect(unguarded).toEqual([]);
  });

  it("الحارس في أول جسم الدالة قبل أي استعلام (ليس بعد await لبيانات)", () => {
    const pages = walk(ROOT).filter((f) => f.endsWith("page.tsx"));
    for (const f of pages) {
      const src = readFileSync(f, "utf8");
      const i = src.indexOf("export default");
      const body = src.slice(i);
      const guardAt = body.search(GUARD);
      const firstData = body.search(/await db\./);
      if (firstData !== -1) expect(guardAt, f).toBeLessThanOrEqual(firstData + 40);
    }
  });
});
