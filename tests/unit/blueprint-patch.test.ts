import { describe, expect, it } from "vitest";
import { applyChanges, diffBlueprint, stableJson } from "@/lib/blueprint-patch";
import { describeIssue, issueMessage } from "@/blueprint/issues";
import { blueprintSchema, type StoreBlueprint } from "@/blueprint/schema";
import { defaultBlueprint } from "@/blueprint/defaults";

const bp = () => blueprintSchema.parse(defaultBlueprint({ name: "متجر تجربة", tagline: "سطر" } as never)) as StoreBlueprint;
const rec = (x: unknown) => x as Record<string, unknown>;

describe("diffBlueprint / applyChanges", () => {
  it("يحفظ ما تغيّر فقط: تعديل حُفظ من صفحة أخرى بعد الفتح يبقى", () => {
    const opened = bp();
    // صفحة المحتوى عدّلت اسم العلامة.
    const edited = { ...opened, brand: { ...opened.brand, name: "اسم جديد" } };
    // بعد فتح المحرر، صفحة الشحن حفظت سعراً ثابتاً على الخادم.
    const server = { ...opened, shipping: { ...opened.shipping, flatRatePiasters: 4500 } };

    const changes = diffBlueprint(rec(opened), rec(edited));
    expect(changes).toEqual([{ path: ["brand", "name"], value: "اسم جديد" }]);

    const next = applyChanges(rec(server), changes) as unknown as StoreBlueprint;
    expect(next.brand.name).toBe("اسم جديد");
    expect(next.shipping.flatRatePiasters).toBe(4500);
    // لا يعدّل الأصل.
    expect(server.brand.name).toBe(opened.brand.name);
  });

  it("المصفوفات تُقارن كاملة (ترتيب الأقسام تغيير واحد)", () => {
    const opened = bp();
    const home = [...opened.home].reverse();
    const changes = diffBlueprint(rec(opened), rec({ ...opened, home }));
    expect(changes).toHaveLength(1);
    expect(changes[0]!.path).toEqual(["home"]);
  });

  it("المفتاح المحذوف يُحذف، والمفتاح الجديد يُضاف", () => {
    const changes = diffBlueprint({ a: { x: 1, y: 2 }, b: 1 }, { a: { x: 1 }, c: 3 });
    expect(changes).toEqual(
      expect.arrayContaining([
        { path: ["a", "y"], value: undefined },
        { path: ["b"], value: undefined },
        { path: ["c"], value: 3 },
      ])
    );
    expect(applyChanges({ a: { x: 1, y: 2 }, b: 1, d: 4 }, changes)).toEqual({ a: { x: 1 }, c: 3, d: 4 });
  });

  it("ترتيب المفاتيح لا يُعدّ تغييراً (jsonb يعيد ترتيبها)", () => {
    const a = { brand: { name: "س", tagline: "ت" }, seo: { title: "ع", description: "و" } };
    const b = { seo: { description: "و", title: "ع" }, brand: { tagline: "ت", name: "س" } };
    expect(stableJson(a)).toBe(stableJson(b));
    expect(diffBlueprint(a, b)).toEqual([]);
    expect(stableJson([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
  });

  it("لا تغييرات بين نسختين متطابقتين", () => {
    const a = bp();
    expect(diffBlueprint(rec(a), rec(JSON.parse(JSON.stringify(a))))).toEqual([]);
  });
});

describe("describeIssue", () => {
  it("يسمّي القسم والحقل بالعربية ويحدد مكانه", () => {
    const b = bp();
    const i = b.home.findIndex((s) => s.type === "hero");
    expect(i).toBeGreaterThanOrEqual(0);
    const broken = { ...b, home: b.home.map((s, k) => (k === i ? { ...s, headline: "" } : s)) };
    const r = blueprintSchema.safeParse(broken);
    expect(r.success).toBe(false);
    const d = describeIssue(r.error!.issues[0]!, broken);
    expect(d.text).toBe("قسم «الواجهة الرئيسية» · العنوان الرئيسي: لا يمكن أن يكون فارغاً");
    expect(d.target).toEqual({ top: "home", sectionId: b.home[i]!.id });
  });

  it("الحدود بصيغة عربية صحيحة", () => {
    expect(issueMessage({ code: "too_big", type: "string", maximum: 60, inclusive: true, path: [], message: "" })).toBe("أطول من المسموح (الحد 60 حرفاً)");
    expect(issueMessage({ code: "too_small", type: "array", minimum: 1, inclusive: true, path: [], message: "" })).toBe("أضف عنصراً واحداً على الأقل");
    expect(issueMessage({ code: "invalid_string", validation: "url", path: [], message: "" })).toBe("الرابط غير صحيح، يبدأ بـ https://");
  });
});
