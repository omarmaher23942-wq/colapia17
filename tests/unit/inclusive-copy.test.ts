// قاعدة المالك (2026-10-13، CLAUDE.md 6.1): النصوص المرئية تخاطب أي شخص. هذا الحارس يرفض صيغ المؤنث الحصرية وعامية
// المذكر الصريحة في ما يراه زائر المتجر والتاجر (المتجر، الهبوط، الاستمارة، المتابعة، البريد، النصوص الافتراضية).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = [
  "src/components/storefront",
  "src/components/blocks",
  "src/components/landing",
  "src/components/intake",
  "src/app/s",
  "src/app/(platform)/start",
  "src/app/(platform)/follow",
  "src/app/(platform)/terms",
  "src/app/(platform)/privacy",
  "src/lib/email-templates",
  "src/blueprint/defaults.ts",
  "src/blueprint/copy.ts",
  "src/blueprint/facts.ts",
  "src/blueprint/schema.ts",
  "src/lib/order-messages.ts",
  "src/intake",
  "src/lifecycle/templates.ts",
  "src/lifecycle/handlers.ts",
  "src/components/dashboard/billing",
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
