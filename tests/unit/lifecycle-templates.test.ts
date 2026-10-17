import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({
  db: {
    select: () => {
      throw new Error("no db in unit tests");
    },
  },
}));
vi.mock("@/lib/env", () => ({ clientEnv: { NEXT_PUBLIC_APP_URL: "https://colapia.com" }, env: { VODAFONE_CASH_NUMBER: "01000000000", INSTAPAY_NUMBER: "x@instapay" } }));
vi.mock("@/server/pricing", () => ({ currentPricing: async () => ({}) }));
vi.mock("@/lib/email", () => ({ sendTemplatedEmail: async () => ({ ok: true }) }));

import { TEMPLATE_DEFAULTS, renderTemplate, type TemplateKey } from "@/lifecycle/templates";

const VAR_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
const keys = Object.keys(TEMPLATE_DEFAULTS) as TemplateKey[];

describe("قوالب دورة الحياة", () => {
  it("تحوي مفاتيح الإعداد التي تعتمد عليها مهام الوكيل", () => {
    for (const k of ["setup.link", "setup.reminder_24h", "setup.reminder_72h", "setup.purged"] as const) expect(keys).toContain(k);
  });

  it("كل متغير في النص معرّف في vars", () => {
    for (const k of keys) {
      const used = [...TEMPLATE_DEFAULTS[k].body.matchAll(VAR_RE)].map((m) => m[1]!);
      const declared = TEMPLATE_DEFAULTS[k].vars as readonly string[];
      for (const u of used) expect(declared, `${k} يستخدم {{${u}}} غير معرّف`).toContain(u);
    }
  });

  it("الرسم بكل المتغيرات لا يترك {{ }} ولا يذكر الذكاء الاصطناعي أو التقنيات", async () => {
    await Promise.all(
      keys.map(async (k) => {
        const vars = Object.fromEntries((TEMPLATE_DEFAULTS[k].vars as readonly string[]).map((v) => [v, "قيمة"]));
        const { text, missing } = await renderTemplate(k, vars);
        expect(text, k).not.toMatch(/\{\{|\}\}/);
        expect(missing, k).toEqual([]);
        expect(text, k).not.toMatch(/ذكاء اصطناعي|Groq|Gemini|Vercel|Neon|GitHub/i);
      })
    );
  });

  it("المتغير الناقص يُحذف ولا يبقى قوساً", async () => {
    const r = await renderTemplate("payment.rejected", { store: "نور" });
    expect(r.text).not.toContain("{{");
    expect(r.missing.length).toBeGreaterThan(0);
  });
});
