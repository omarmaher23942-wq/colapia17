import { describe, expect, it } from "vitest";
import { assessLogo, dominantColors, harmonies } from "@/lib/logo-palette";
import { assessPhoto, dHash, duplicatePairs, hamming, sharpness, type Gray } from "@/lib/photo-quality";
import { imageSrcSet, thumbUrl, transformImage } from "@/lib/image-url";
import { needsCompression, pickRecorderMime, planCompression } from "@/lib/video-compress";
import { aiAvailable, aiCaps, checkCaps } from "@/lib/ai-status";
import { remainingLabel, remainingMinutes } from "@/lib/setup-time";
import { suggestionFor } from "@/lib/niche-defaults";

const solid = (w: number, h: number, v: number): Gray => ({ data: new Uint8Array(w * h).fill(v), w, h });
const noise = (w: number, h: number): Gray => ({ data: Uint8Array.from({ length: w * h }, (_, i) => ((i * 7919) % 251)), w, h });
const grad = (w: number, h: number, flip = false): Gray => ({ data: Uint8Array.from({ length: w * h }, (_, i) => { const x = i % w; return Math.round(((flip ? w - 1 - x : x) / w) * 255); }), w, h });

describe("logo-palette", () => {
  it("لون مهيمن يتجاهل الأبيض والشفاف", () => {
    const px: number[] = [];
    for (let i = 0; i < 50; i++) px.push(200, 30, 30, 255);
    for (let i = 0; i < 200; i++) px.push(255, 255, 255, 255, 10, 10, 10, 0);
    for (let i = 0; i < 20; i++) px.push(20, 40, 200, 255);
    const out = dominantColors(px);
    expect(out).toHaveLength(2);
    expect(out[0]!.toLowerCase()).toMatch(/^#c\w1\w1\w$/i);
  });
  it("تناسق", () => {
    const h = harmonies("#ff0000");
    expect(h.map((x) => x.id)).toEqual(["complementary", "analogous", "triadic", "split"]);
    expect(h[0]!.colors[0]!.toLowerCase()).toBe("#00ffff");
  });
  it("جودة الشعار", () => {
    expect(assessLogo({ w: 100, h: 100, hasAlpha: true, cornerOpaqueLight: false })[0]!.id).toBe("small");
    expect(assessLogo({ w: 800, h: 800, hasAlpha: false, cornerOpaqueLight: true })[0]!.id).toBe("opaque_bg");
    expect(assessLogo({ w: 800, h: 800, hasAlpha: true, cornerOpaqueLight: false })[0]!.id).toBe("ok");
  });
});

describe("photo-quality", () => {
  it("ضبابية وإضاءة ودقة", () => {
    expect(sharpness(solid(40, 40, 120))).toBe(0);
    expect(assessPhoto(solid(40, 40, 120), { w: 2000, h: 2000 })).toContain("blurry");
    expect(assessPhoto(solid(40, 40, 10), { w: 2000, h: 2000 })).toContain("dark");
    expect(assessPhoto(noise(40, 40), { w: 400, h: 400 })).toEqual(["small"]);
    expect(assessPhoto(noise(40, 40), { w: 2000, h: 2000 })).toEqual([]);
  });
  it("صور مكررة", () => {
    const a = dHash(grad(90, 80));
    const b = dHash(grad(180, 160));
    const c = dHash(grad(90, 80, true));
    expect(hamming(a, b)).toBeLessThanOrEqual(5);
    expect(hamming(a, c)).toBeGreaterThan(30);
    expect(duplicatePairs([a, c, b])).toEqual([[0, 2]]);
  });
});

describe("image-url", () => {
  it("ImageKit فقط", () => {
    const u = "https://ik.imagekit.io/abc/p/1.jpg";
    expect(transformImage(u, { w: 320 })).toContain("tr=w-320%2Cq-80%2Cf-auto");
    expect(transformImage("https://example.com/a.jpg", { w: 320 })).toBe("https://example.com/a.jpg");
    expect(imageSrcSet(u)).toContain("640w");
    expect(imageSrcSet("https://example.com/a.jpg")).toBeUndefined();
    expect(thumbUrl(u)).toContain("h-160");
  });
});

describe("video-compress", () => {
  it("مواصفات", () => {
    const s = planCompression({ width: 1920, height: 1080, duration: 40 });
    expect(s).toMatchObject({ width: 1280, height: 720, seconds: 20 });
    expect(s.bitrate).toBeLessThanOrEqual(2_500_000);
    expect(pickRecorderMime((m) => m.startsWith("video/webm"))!.ext).toBe("webm");
    expect(pickRecorderMime(() => true)!.ext).toBe("mp4");
    expect(pickRecorderMime(() => false)).toBeNull();
    expect(needsCompression({ bytes: 1 << 20, width: 800, duration: 10 })).toBe(false);
    expect(needsCompression({ bytes: 30 << 20, width: 800, duration: 10 })).toBe(true);
  });
});

describe("ai-status وsetup-time وniche", () => {
  it("مفاتيح وحدود", () => {
    expect(aiAvailable({})).toBe(false);
    expect(aiAvailable({ GROQ_API_KEY: "gsk_" + "a".repeat(30) })).toBe(true);
    expect(aiAvailable({ GROQ_API_KEY: "xxxxxxxxxxxxxxxxxxxxxx" })).toBe(false);
    expect(aiCaps({ AI_CAP_DAILY: "abc" })).toEqual({ perDay: 300, perMonth: 4000 });
    expect(checkCaps({ day: 300, month: 0 }, aiCaps({}))).toMatchObject({ ok: false, reason: "day" });
    expect(checkCaps({ day: 1, month: 1 }, aiCaps({})).ok).toBe(true);
  });
  it("الوقت", () => {
    expect(remainingMinutes(["identity"], ["identity", "products", "publish"])).toBe(5);
    expect(remainingMinutes(["identity"], ["identity"])).toBe(0);
    expect(remainingLabel(2)).toBe("نحو دقيقتين متبقيتين");
  });
  it("اقتراح النشاط", () => {
    expect(suggestionFor("perfume").returnsDays).toBe(0);
  });
});
