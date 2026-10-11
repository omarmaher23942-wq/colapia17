import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "../../template/src/lib/env";
import { blueprintSchema } from "@/blueprint/schema";
import { defaultBlueprint } from "@/blueprint/defaults";
import { generatePolicyPage } from "@/blueprint/policy-pages";

describe("merchant database url", () => {
  const pg = "postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require";
  it("finds the Neon url whatever prefix Vercel used, preferring pooled", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: pg })).toBe(pg);
    expect(resolveDatabaseUrl({ STORAGE_URL: pg })).toBe(pg);
    expect(resolveDatabaseUrl({ MYSHOP_DATABASE_URL_UNPOOLED: pg + "&u=1", MYSHOP_DATABASE_URL: pg })).toBe(pg);
    expect(resolveDatabaseUrl({ NODE_ENV: "production", OTHER: "https://x.com" })).toBe("");
  });
});

describe("defect policy is the merchant's choice", () => {
  const bp = blueprintSchema.parse(defaultBlueprint({ name: "متجر", storeId: "s" } as never));
  const page = (returns: Partial<typeof bp.returns>) => generatePolicyPage({ ...bp, returns: { ...bp.returns, ...returns } }, "returns")!.body;
  it("omits any defect promise when the merchant chose none", () => {
    const body = page({ windowDays: 0, allowExchange: false, allowRefund: false, defectPolicy: "none" });
    expect(body).not.toContain("معيب");
    expect(body).not.toContain("48");
  });
  it("writes the exact window and shipping the merchant picked", () => {
    const body = page({ defectPolicy: "replace", defectReportHours: 168, defectShippingByStore: false });
    expect(body).toContain("7 أيام");
    expect(body).toContain("سنستبدله");
    expect(body).toContain("على العميل");
  });
});

describe("csv export", async () => {
  const { toCsv } = await import("@/server/csv");
  it("opens in Arabic Excel and neutralises formulas", () => {
    const out = toCsv(["الاسم", "ملاحظة"], [["مياده", "=HYPERLINK(\"x\")"], ["علي, محمد", "سطر\nثاني"]]);
    expect(out.startsWith("\uFEFF")).toBe(true);
    expect(out).toContain(`"'=HYPERLINK(""x"")"`);
    expect(out).toContain(`"علي, محمد"`);
  });
});
