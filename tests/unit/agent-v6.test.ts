// وكيل V6: الاسم والواتساب دفعة واحدة ← ليد في لوحة المالك. الحراسة الخالصة للفعل والبيانات وحالة المحادثة.
import { describe, expect, it } from "vitest";
import { checkAction, groundContact } from "@/ai/agents/closer/review";
import { parseCloserTurn } from "@/ai/agents/closer/turn";
import { CLOSER_V6_PROMPT } from "@/ai/agents/closer/prompt";
import { stateBlock } from "@/agent/state";
import { leadMail } from "@/agent/owner-mail";
import { leadRecordOf, whatsappLink } from "@/agent/lead-capture";

const turn = (o: object) => parseCloserTurn(JSON.stringify({ reply: "تمام", ...o }))!;

describe("فعل lead", () => {
  const ok = { name: "أحمد", whatsapp: "01012345678", email: undefined, service: "متجر" };
  it("يلزمه اسم ورقم واتساب مصري صالح، والبريد اختياري لكن يجب أن يصح إن كُتب", () => {
    expect(checkAction("lead", { contact: ok, alreadyCaptured: false }).ok).toBe(true);
    expect(checkAction("lead", { contact: { ...ok, name: undefined }, alreadyCaptured: false }).ok).toBe(false);
    expect(checkAction("lead", { contact: { ...ok, whatsapp: "123" }, alreadyCaptured: false }).ok).toBe(false);
    expect(checkAction("lead", { contact: { ...ok, email: "bad" }, alreadyCaptured: false }).ok).toBe(false);
    expect(checkAction("lead", { contact: { ...ok, email: "a@b.com" }, alreadyCaptured: false }).ok).toBe(true);
    expect(checkAction("lead", { contact: ok, alreadyCaptured: true }).ok).toBe(false);
    expect(checkAction("none", { contact: {}, alreadyCaptured: false }).ok).toBe(true);
  });
  it("لا يُقبل من البيانات إلا ما كتبه العميل فعلاً (حتى بأرقام هندية)", () => {
    const c = { name: "أحمد سمير", whatsapp: "01012345678", email: "x@y.com", service: "موقع" };
    expect(groundContact(c, ["اسمي أحمد سمير ورقمي ٠١٠١٢٣٤٥٦٧٨"])).toMatchObject({ name: "أحمد سمير", whatsapp: "01012345678", email: undefined });
    expect(groundContact(c, ["عايز موقع"]).whatsapp).toBeUndefined();
    expect(groundContact(c, ["عايز موقع"]).name).toBeUndefined();
  });
  it("التحليل: الأفعال المعروفة فقط وcontact اختياري", () => {
    expect(turn({ action: "lead", contact: { name: "علي" } }).action).toBe("lead");
    expect(turn({ action: "build_request" }).action).toBe("none");
    expect(turn({}).contact).toEqual({});
  });
});

describe("حالة المحادثة والبرومبت", () => {
  const base = { replies: 0, channel: "instagram" as const, summary: "", offer: { golden: true, seatsLeft: 9, seatsTotal: 10 }, captured: false, idleHours: null };
  it("أصل المحادثة والمقاعد الحقيقية والليد المسجل", () => {
    expect(stateBlock({ ...base, origin: "us", openingText: "ممكن توصلونا بصاحب المتجر؟" })).toContain("فريقنا هو من بدأ");
    expect(stateBlock({ ...base, origin: "them" })).toContain("بدأ المحادثة بنفسه");
    expect(stateBlock(base)).toContain("يصلح في الحالتين");
    expect(stateBlock(base)).toContain("9 مقاعد");
    expect(stateBlock({ ...base, offer: { golden: false, seatsLeft: 0, seatsTotal: 10 } })).toContain("انتهت");
    expect(stateBlock({ ...base, captured: true })).toContain("سُجّلت بيانات");
  });
  it("البرومبت: لا دفع ولا عربون، ولا إلزام بأسئلة، ويذكر Qima والموقع وعدم وجود اشتراك", () => {
    expect(CLOSER_V6_PROMPT).toContain("لا تطلب دفعاً ولا عربوناً");
    expect(CLOSER_V6_PROMPT).toContain("{{qimaUrl}}");
    expect(CLOSER_V6_PROMPT).toContain("{{siteUrl}}");
    expect(CLOSER_V6_PROMPT).toContain("لا اشتراك شهري");
    expect(CLOSER_V6_PROMPT).toContain('"lead"');
  });
});

describe("الليد في لوحة المالك", () => {
  it("بريد الإشعار وقراءة السجل ورابط واتساب", () => {
    const m = leadMail({ name: "منى", whatsapp: "01012345678", service: "نظام حجز", summary: "عيادة", channel: "instagram", igUsername: "mona" });
    expect(m.subject).toContain("منى");
    expect(m.paragraphs.join("\n")).toContain("01012345678");
    const rec = leadRecordOf({ v6Lead: { name: "منى", whatsapp: "01012345678", at: "2026-10-27T10:00:00Z" } });
    expect(rec).toMatchObject({ name: "منى", status: "new", service: "" });
    expect(leadRecordOf({})).toBeNull();
    expect(whatsappLink("01012345678")).toBe("https://wa.me/201012345678");
  });
});
