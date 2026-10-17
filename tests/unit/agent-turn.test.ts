import { describe, expect, it } from "vitest";
import { extractJsonObject, looksLikeLeak, parseCloserTurn } from "@/ai/agents/closer/turn";

describe("تحليل دور الوكيل الصارم", () => {
  it("يقبل JSON صالحاً بحقل reply ويطبّع الحقول", () => {
    const t = parseCloserTurn(JSON.stringify({ reply: "أهلاً بكم", memory: "ملابس", requestHuman: null, lead: { niche: "ملابس", email: null }, confirmCreate: false }));
    expect(t?.reply).toBe("أهلاً بكم");
    expect(t?.lead.niche).toBe("ملابس");
    expect(t?.lead.email).toBeUndefined();
    expect(t?.confirmCreate).toBe(false);
    expect(t?.requestHuman).toBeNull();
  });

  it("يتجاوز أسوار Markdown ونصاً حول الكائن", () => {
    const t = parseCloserTurn('هذا ردي:\n```json\n{"reply":"تمام","confirmCreate":true,}\n```');
    expect(t?.reply).toBe("تمام");
    expect(t?.confirmCreate).toBe(true);
  });

  it("يرفض JSON مكسوراً أو بلا reply أو reply فارغاً", () => {
    expect(parseCloserTurn('{"reply": "ناقص')).toBeNull();
    expect(parseCloserTurn("مرحباً بكم، كيف أساعدكم؟")).toBeNull();
    expect(parseCloserTurn('{"memory":"x"}')).toBeNull();
    expect(parseCloserTurn('{"reply":"   "}')).toBeNull();
    expect(parseCloserTurn('{"reply": 5}')).toBeNull();
    expect(parseCloserTurn("[1,2]")).toBeNull();
  });

  it("لا يرسل أبداً رداً يسرّب بنية الحقول", () => {
    expect(parseCloserTurn(JSON.stringify({ reply: '{"reply":"x","memory":"y"}' }))).toBeNull();
    expect(parseCloserTurn(JSON.stringify({ reply: 'جاهز "confirmCreate": true' }))).toBeNull();
    expect(looksLikeLeak("أهلاً بكم")).toBe(false);
  });

  it("يزيل الإيموجي من الرد", () => {
    const t = parseCloserTurn(JSON.stringify({ reply: "أهلاً بكم 😀" }));
    expect(t?.reply).toBe("أهلاً بكم");
  });

  it("extractJsonObject يتعامل مع الأقواس داخل النصوص", () => {
    expect(extractJsonObject('x {"a":"}{","b":{"c":1}} y')).toEqual({ a: "}{", b: { c: 1 } });
  });
});
