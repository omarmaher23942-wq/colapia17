import { describe, expect, it } from "vitest";
import { decide, pickCandidates, scoreItem, tokens, type CatalogItem, type VisionRead } from "@/lib/visual-search";

const item = (id: string, name: string, text = "", orderCount = 0): CatalogItem => ({ id, name, text, image: `https://m/${id}.jpg`, orderCount });
const read = (p: Partial<VisionRead>): VisionRead => ({ isProduct: true, garment: null, colors: [], keywords: [], visibleText: null, ...p });

describe("visual search ranking", () => {
  it("normalizes tokens and drops the article", () => {
    expect(tokens("الفستان الأسود!")).toEqual(["فستان", "اسود"]);
  });
  it("prefers garment and colour matches across Arabic/English", () => {
    const dress = item("d", "فستان كتان", "أسود وبيج");
    const tee = item("t", "تيشيرت قطن", "أبيض");
    const r = read({ garment: "dress فستان", colors: ["black"], keywords: ["linen"] });
    expect(scoreItem(r, dress)).toBeGreaterThan(scoreItem(r, tee));
  });
  it("small catalogs compare everything; large ones keep the top scored", () => {
    const few = [item("a", "فستان"), item("b", "عباية")];
    expect(pickCandidates(read({}), few)).toHaveLength(2);
    const many = ["عباية", "تيشيرت", "بنطلون", "جاكيت", "فستان سهرة", "شنطة"].map((n, i) => item(String(i), n, "", i));
    const top = pickCandidates(read({ garment: "فستان" }), many);
    expect(top[0]!.name).toBe("فستان سهرة");
    expect(top).toHaveLength(4);
  });
  it("only claims a match with enough confidence", () => {
    const c = [item("a", "a"), item("b", "b"), item("c", "c")];
    expect(decide({ best: 2, confidence: 0.9, similar: [3] }, c)).toEqual({ match: c[1], similar: [c[2]] });
    const low = decide({ best: 2, confidence: 0.4, similar: [3] }, c);
    expect(low.match).toBeNull();
    expect(low.similar.map((x) => x.id)).toEqual(["b", "c"]);
    expect(decide({ best: 9, confidence: 1, similar: [] }, c)).toEqual({ match: null, similar: [] });
  });
});
