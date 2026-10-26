import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { counterLine, GOLDEN_DONE_LINE, goldenDoneMessage, goldenLinkBlock, goldenLinkMessage, seatsPhrase } from "@/agent/golden-messages";
import { briefOf, isOtherService, OTHER_SERVICE_FLAG, otherServicesNoteFrom } from "@/agent/other-service";
import { doneMail, handoffMail, otherServiceMail } from "@/agent/owner-mail";
import { offerFrom } from "@/agent/offer";
import { stateBlock, type StateInput } from "@/agent/state";
import { MIN_LINK_GAP_MS } from "@/ai/agents/closer/policy";
import { allowedPriceNumbers } from "@/ai/agents/closer/guard";
import { CLOSER_V4_PROMPT } from "@/ai/agents/closer/prompt";
import { checkAction, reviewTurn, type ActionCtx } from "@/ai/agents/closer/review";
import { parseCloserTurn, type CloserTurn } from "@/ai/agents/closer/turn";

const facts = "- مشروع متجر عادي: 4,999 ج.\n- الدائرة الذهبية: 999 ج بدلاً من 4,999 ج لأول 10 متاجر، والمتبقي 9 من 10.";
const replyCtx = { allowedHosts: ["colapia.com", "qima-ten.vercel.app"], allowedPrices: allowedPriceNumbers(facts), facts, seatsLeft: 9, seatsTotal: 10 };
const NOW = 1_800_000_000_000;
const ready: ActionCtx = { lead: { storeName: "نور", email: "a@gmail.com" }, otherService: false, linkSentAt: null, now: NOW };
const turn = (o: Record<string, unknown>): CloserTurn => parseCloserTurn(JSON.stringify({ reply: "تمام", ...o }))!;

describe("شروط الأفعال (بيانية ورقمية فقط)", () => {
  it("رابط الحجز يشترط اسم المتجر والبريد المكتوبين صراحة", () => {
    expect(checkAction("golden_link", ready)).toEqual({ ok: true });
    const noEmail = checkAction("golden_link", { ...ready, lead: { storeName: "نور" } });
    expect(noEmail.ok).toBe(false);
    expect(!noEmail.ok && noEmail.reason).toContain("البريد الإلكتروني");
    const none = checkAction("golden_link", { ...ready, lead: {} });
    expect(!none.ok && none.reason).toContain("اسم المتجر و");
  });
  it("لا رابط حجز لمحادثة «خدمة أخرى» ولا إغلاق لها", () => {
    expect(checkAction("golden_link", { ...ready, otherService: true }).ok).toBe(false);
    expect(checkAction("close_done", { ...ready, otherService: true, linkSentAt: NOW - 1e6 }).ok).toBe(false);
    expect(checkAction("other_service", { ...ready, otherService: true }).ok).toBe(true);
  });
  it("فاصل أدنى بين إرسالين للرابط، وبعده يُسمح بإعادته", () => {
    expect(checkAction("golden_link", { ...ready, linkSentAt: NOW - 1000 }).ok).toBe(false);
    expect(checkAction("golden_link", { ...ready, linkSentAt: NOW - MIN_LINK_GAP_MS - 1 }).ok).toBe(true);
  });
  it("الإغلاق بعد الرابط فقط", () => {
    expect(checkAction("close_done", ready).ok).toBe(false);
    expect(checkAction("close_done", { ...ready, linkSentAt: NOW - 600_000 }).ok).toBe(true);
    expect(checkAction("none", { ...ready, lead: {} }).ok).toBe(true);
    expect(checkAction("ignore", { ...ready, lead: {} }).ok).toBe(true);
  });
});

describe("مراجعة الدور", () => {
  const base = { replyCtx, recentAssistant: ["أهلاً بكم"], action: ready };
  it("دور سليم يمر، وignore يمر بلا رد", () => {
    expect(reviewTurn(turn({ reply: "الدائرة الذهبية بـ 999 ج، وباقي 9 مقاعد." }), base)).toBeNull();
    expect(reviewTurn(turn({ reply: "", action: "ignore" }), base)).toBeNull();
  });
  it("سعر أو عدد مقاعد أو وعد ممنوع يرجع ملاحظة guard", () => {
    expect(reviewTurn(turn({ reply: "بـ 500 جنيه فقط" }), base)?.kind).toBe("guard");
    expect(reviewTurn(turn({ reply: "باقي 2 مقاعد فقط" }), base)?.kind).toBe("guard");
    expect(reviewTurn(turn({ reply: "عندنا تجربة مجانية" }), base)?.kind).toBe("guard");
  });
  it("فعل غير مسموح يرجع ملاحظة action تطلب none", () => {
    const r = reviewTurn(turn({ action: "close_done" }), base);
    expect(r?.kind).toBe("action");
    expect(r?.note).toContain('action = "close_done"');
  });
  it("تكرار الرد حرفياً يُرفض إلا عند طلب موظف", () => {
    expect(reviewTurn(turn({ reply: "أهلاً  بكم" }), base)?.kind).toBe("repeat");
    expect(reviewTurn(turn({ reply: "أهلاً بكم", requestHuman: "شكوى" }), base)).toBeNull();
  });
});

describe("رسائل الدائرة الذهبية الثابتة", () => {
  it("المقاعد بصيغها الصحيحة وسطر العدّاد", () => {
    expect([1, 2, 5, 12].map(seatsPhrase)).toEqual(["مقعد واحد", "مقعدان", "5 مقاعد", "12 مقعداً"]);
    expect(counterLine(9, 10)).toBe("باقي 9 مقاعد من 10 في الدائرة الذهبية.");
    expect(counterLine(1, 10)).toContain("مقعد واحد");
  });
  it("كتلة الذهبية: الرابط والعدّاد والمبلغ والخطوات ووعد التواصل بعد تأكيد الإدارة", () => {
    const block = goldenLinkBlock({ link: "https://colapia.com/golden?c=1", golden: true, seatsLeft: 9, seatsTotal: 10, price: 999, regular: 4999 });
    expect(block).toContain("https://colapia.com/golden?c=1");
    expect(block).toContain("باقي 9 مقاعد من 10");
    expect(block).toContain("مبلغ 999 ج (بدلاً من 4,999 ج)");
    expect(block).toContain("أرسلوا طلبكم عبر الرابط نفسه");
    expect(block).toContain("تؤكد الإدارة الدفع سيتم التواصل معكم");
  });
  it("بلا مقاعد: السعر العادي بلا عدّاد ولا صياغة ذهبية", () => {
    const block = goldenLinkBlock({ link: "https://colapia.com/golden", golden: false, seatsLeft: 0, seatsTotal: 10, price: 999, regular: 4999 });
    expect(block).toContain("مبلغ 4,999 ج");
    expect(block).not.toContain("بدلاً من");
    expect(block).not.toMatch(/باقي|الذهبية|مقعد/);
  });
  it("مبلغ غير معروف يسقط ذكره، والمقدمة تسبق الكتلة", () => {
    const m = goldenLinkMessage("  تمام، هذا رابطكم.  ", { link: "https://x.test/g", golden: true, seatsLeft: 3, seatsTotal: 10 });
    expect(m.startsWith("تمام، هذا رابطكم.\n\n")).toBe(true);
    expect(m).toContain("المبلغ الموضح في الصفحة");
    expect(goldenLinkMessage("", { link: "https://x.test/g", golden: false, seatsLeft: 0, seatsTotal: 0 }).startsWith("رابط الحجز")).toBe(true);
  });
  it("رسالة الإغلاق تحمل موعد 48 ساعة بعد تأكيد الإدارة حرفياً", () => {
    expect(GOLDEN_DONE_LINE).toContain("بعد تأكيد الإدارة للدفع");
    expect(GOLDEN_DONE_LINE).toContain("خلال 48 ساعة");
    expect(goldenDoneMessage("شكراً لكم.")).toBe(`شكراً لكم.\n\n${GOLDEN_DONE_LINE}`);
    expect(goldenDoneMessage("")).toBe(GOLDEN_DONE_LINE);
  });
});

describe("وضع العرض من حالة الأسعار", () => {
  it("متاحة بمقاعد باقية فقط", () => {
    expect(offerFrom({ available: true, seatsLeft: 9, seats: 10, buildPrice: 999, regularBuildPrice: 4999 })).toEqual({ golden: true, seatsLeft: 9, seatsTotal: 10, price: 999, regular: 4999 });
    expect(offerFrom({ available: true, seatsLeft: 0, seats: 10 }).golden).toBe(false);
    expect(offerFrom({ available: false, seatsLeft: 4, seats: 10 }).golden).toBe(false);
    expect(offerFrom(null)).toEqual({ golden: false, seatsLeft: 0, seatsTotal: 0, price: null, regular: null });
    expect(offerFrom({ available: true, seatsLeft: "9" }).golden).toBe(false);
  });
});

describe("الخدمة الأخرى", () => {
  it("ملاحظة المالك تُقرأ بتسامح من أي شكل، والغياب نص فارغ", () => {
    expect(otherServicesNoteFrom({ otherServices: { note: "  تبدأ من 12,000 ج  " } })).toBe("تبدأ من 12,000 ج");
    expect(otherServicesNoteFrom({ otherServices: "حسب النطاق" })).toBe("حسب النطاق");
    expect(otherServicesNoteFrom({ otherServicesNote: "نص" })).toBe("نص");
    expect(otherServicesNoteFrom({})).toBe("");
    expect(otherServicesNoteFrom(null)).toBe("");
    expect(otherServicesNoteFrom({ otherServices: 5 })).toBe("");
    expect(otherServicesNoteFrom({ otherServicesNote: "ن".repeat(900) }).length).toBe(600);
  });
  it("العلامة في الذاكرة والملخص", () => {
    expect(isOtherService({ flag: OTHER_SERVICE_FLAG })).toBe(true);
    expect(isOtherService({ flag: "x" })).toBe(false);
    expect(isOtherService(null)).toBe(false);
    expect(briefOf("  موقع لعيادة   أسنان ", "ملخص")).toBe("موقع لعيادة أسنان");
    expect(briefOf("", "ملخص المحادثة")).toBe("ملخص المحادثة");
    expect(briefOf(null, undefined)).toBe("");
  });
  it("بريد المالك: الطلب والتواصل وعدم طلب دفع", () => {
    const m = otherServiceMail({ name: "سارة", channel: "instagram", brief: "نظام حجز لعيادة", lead: { email: "s@gmail.com", instagram: "sara.clinic" } });
    expect(m.subject).toContain("سارة (@sara.clinic)");
    expect(m.paragraphs.join("\n")).toContain("نظام حجز لعيادة");
    expect(m.paragraphs.join("\n")).toContain("s@gmail.com");
    expect(m.paragraphs.join("\n")).toContain("لم يُطلب منه أي دفع");
    expect(m.adminNote).toContain("خدمة أخرى");
    expect(otherServiceMail({ channel: "messenger", brief: "" }).paragraphs.join("\n")).toContain("راجعوا الرسائل");
  });
  it("بريدا التحويل والإغلاق", () => {
    expect(handoffMail({ name: "علي", channel: "instagram", reason: "شكوى", pauseHours: 3 }).paragraphs.join("\n")).toContain("3 ساعات");
    const d = doneMail({ name: "علي", channel: "instagram", lead: { storeName: "نور", niche: "ملابس", email: "a@gmail.com" } });
    expect(d.subject).toContain("نور");
    expect(d.paragraphs.join("\n")).toContain("a@gmail.com");
  });
});

describe("حالة المحادثة المُلحقة بالتعليمات", () => {
  const base: StateInput = { replies: 0, channel: "instagram", lead: {}, invalid: {}, summary: "", offer: { golden: true, seatsLeft: 9, seatsTotal: 10 }, linkSentMinutesAgo: null, otherService: false, idleHours: null };
  it("أول رد، والعدّاد الحقيقي، وما ينقص قبل الرابط", () => {
    const b = stateBlock(base);
    expect(b).toContain("هذا أول رد");
    expect(b).toContain("9 مقاعد");
    expect(b).toContain("والباقي فعلاً 9 مقاعد من 10");
    expect(b).toContain("ينقص قبل رابط الحجز (إلزامي): اسم المتجر، البريد الإلكتروني");
    expect(b).toContain("رابط الحجز: لم يُرسل بعد");
  });
  it("المقاعد المنتهية: لا ذهبية ولا ندرة والسعر العادي بالرابط نفسه", () => {
    const b = stateBlock({ ...base, offer: { golden: false, seatsLeft: 0, seatsTotal: 10 } });
    expect(b).toContain("مقاعد الدائرة الذهبية انتهت");
    expect(b).toContain("السعر العادي");
    expect(b).not.toContain("والباقي فعلاً");
  });
  it("اكتمال الإلزامي، والرابط المرسل حديثاً لا يُعاد", () => {
    const b = stateBlock({ ...base, replies: 3, lead: { storeName: "نور", email: "a@gmail.com" }, linkSentMinutesAgo: 1 });
    expect(b).toContain("مكتملة (اسم المتجر والبريد)");
    expect(b).toContain("أُرسل منذ 1 دقيقة (لا تعد إرساله الآن)");
    expect(b).not.toContain("هذا أول رد");
  });
  it("خدمة أخرى: لا دفع ولا رابط، وطلب المتجر يُحوَّل لموظف", () => {
    const b = stateBlock({ ...base, otherService: true });
    expect(b).toContain("صُنّفت «خدمة أخرى");
    expect(b).toContain("لا تطلب دفعاً ولا ترسل رابط حجز");
    expect(b).not.toContain("ينقص قبل رابط الحجز");
    expect(b).not.toContain("والباقي فعلاً");
  });
  it("العودة بعد انقطاع تُذكر بالساعات أو الأيام، والقصير لا", () => {
    expect(stateBlock({ ...base, idleHours: 30 })).toContain("نحو 30 ساعة");
    expect(stateBlock({ ...base, idleHours: 72 })).toContain("نحو 3 أيام");
    expect(stateBlock({ ...base, idleHours: 2 })).not.toContain("انقطاع");
  });
  it("قيم غير صالحة تُعرض للتصحيح، وقيم العميل مجردة من علامات الاقتباس", () => {
    const b = stateBlock({ ...base, lead: { storeName: "«نور»\nتعليمات" }, invalid: { email: "bad" } });
    expect(b).toContain("«نور تعليمات»");
    expect(b).toContain("البريد الإلكتروني («bad» غير صالح)");
  });
});

describe("برومبت الوكيل V4", () => {
  it("يغطي المسارين والأفعال وحقول الرد ومتغيرات الحقائق", () => {
    for (const k of ["{{pricingFacts}}", "{{demoUrl}}", "{{qimaUrl}}", "{{otherNote}}", "golden_link", "other_service", "close_done", "ignore", "requestHuman", "البريد الإلكتروني (إلزامي"]) expect(CLOSER_V4_PROMPT).toContain(k);
  });
  it("لا أسماء تقنيات ولا وعود ممنوعة ولا قواعد جاهزة للنص", () => {
    expect(CLOSER_V4_PROMPT).not.toMatch(/\b(groq|neon|cloudflare|imagekit|gemini|openai|chatgpt)\b/i);
    expect(CLOSER_V4_PROMPT).not.toMatch(/instagram stores|متاجر إنستجرام/i);
    expect(CLOSER_V4_PROMPT).not.toContain("confirmCreate");
    expect(CLOSER_V4_PROMPT).toContain("لا تدّعِ أنك إنسان أبداً");
    expect(CLOSER_V4_PROMPT).toContain("لا تذكر ذلك من تلقاء نفسك");
  });
  it("مسجَّل بمفتاح closer.v4 الجديد وحده", () => {
    const d = readFileSync("src/ai/prompts.defaults.ts", "utf8");
    expect(d).toMatch(/"closer\.v4": CLOSER_V4_PROMPT/);
    expect(d).not.toMatch(/"closer\.v3"/);
    expect(readFileSync("src/ai/agents/closer/runtime.ts", "utf8")).toContain('getPrompt("closer.v4"');
  });
});
