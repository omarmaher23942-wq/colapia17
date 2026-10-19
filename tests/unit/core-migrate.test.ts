import { describe, expect, it } from "vitest";
import { defaultBlueprint } from "@/blueprint/defaults";
import { coreHeroVariant, migrateToCore } from "@/blueprint/core-migrate";
import { blueprintSchema, type Section } from "@/blueprint/schema";

describe("core migrate", () => {
  it("يحوّل شريط الإعلانات القديم إلى الرأس ويزيله من الرئيسية", () => {
    const bp = defaultBlueprint({ name: "متجر" });
    const ann = { id: "a1", type: "announcement", enabled: true, variant: "marquee", messages: [{ text: "شحن مجاني فوق 500" }], dismissible: false, sticky: true, spacing: "normal", background: "default", reveal: "fade" } as unknown as Section;
    const old = { ...bp, header: { ...bp.header, announcement: undefined }, home: [ann, ...bp.home.filter((s) => s.type !== "announcement")] };
    const out = migrateToCore(old);
    expect(out.header.announcement?.items[0]?.text).toBe("شحن مجاني فوق 500");
    expect(out.home.some((s) => s.type === "announcement")).toBe(false);
    expect(blueprintSchema.safeParse(out).success).toBe(true);
  });
  it("الواجهة ثلاثة تخطيطات", () => {
    expect(coreHeroVariant({ videoUrl: "/demo/media/hero-fashion.mp4", images: [] })).toBe("video");
    expect(coreHeroVariant({ images: [{ url: "https://x.y/a.jpg", alt: "", focalX: 0.5, focalY: 0.5 }] })).toBe("split");
    expect(coreHeroVariant({ images: [] })).toBe("product_spotlight");
  });
  it("المتجر القديم (بلا تصميم V3) صالح بعد التحويل وبلا حركات استعراضية، وخلفيته توكن صريح", () => {
    const bp = defaultBlueprint({ name: "متجر" });
    const old = { ...bp, design: { ...bp.design, theme: undefined, cardStyle: undefined }, theme: { ...bp.theme, background: undefined } };
    const out = migrateToCore(old);
    expect(blueprintSchema.safeParse(out).success).toBe(true);
    expect(out.design.motion.level).toBe("calm");
    expect(out.theme.background?.color).toBe(bp.theme.palette.background);
    expect(out.design.cardStyle).toBeTruthy();
    for (const s of out.home) if (s.type === "hero") expect(["video", "split", "product_spotlight"]).toContain(s.variant);
  });
  it("المتجر بتصميم V3 يحتفظ بحركة تصميمه", () => {
    const out = migrateToCore(defaultBlueprint({ name: "متجر" }));
    expect(blueprintSchema.safeParse(out).success).toBe(true);
    expect(out.design.theme).toBe("midnight-mercury");
    expect(out.design.motion.level).toBe("lively");
    for (const s of out.home) if (s.type === "hero") expect(["video", "split", "product_spotlight"]).toContain(s.variant);
  });
});
