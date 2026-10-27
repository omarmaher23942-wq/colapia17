import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { AREAS, areaCovered, buildRequestData, buildRequestMessage, openAreas, parseDeclined, priceLine, seatsPhrase, windowPhrase } from "@/agent/build-request";
import { briefOf, isOtherService, OTHER_SERVICE_FLAG, otherServicesNoteFrom } from "@/agent/other-service";
import { buildRequestMail, handoffMail, otherServiceMail } from "@/agent/owner-mail";
import { agentFactsText, offerFrom } from "@/agent/offer";
import { stateBlock, type StateInput } from "@/agent/state";
import { allowedPriceNumbers, replyProblem } from "@/ai/agents/closer/guard";
import { CLOSER_V5_PROMPT } from "@/ai/agents/closer/prompt";
import { checkAction, reviewTurn, type ActionCtx } from "@/ai/agents/closer/review";
import { parseCloserTurn, type CloserTurn } from "@/ai/agents/closer/turn";

const goldenOffer = { golden: true, seatsLeft: 9, seatsTotal: 10, price: 999, regular: 4999 };
const facts = agentFactsText(goldenOffer);
const replyCtx = { allowedHosts: ["colapia.com", "demo.colapia.com", "qima-ten.vercel.app"], allowedPrices: allowedPriceNumbers(facts), facts, seatsLeft: 9, seatsTotal: 10 };
const full = { storeName: "نور", niche: "ملابس حريمي", products: "صور على الموبايل", styleNotes: "فخم وهادئ", selling: "دفع عند الاستلام", whatsapp: "01012345678" };
const ready: ActionCtx = { lead: full, declined: [], otherService: false, alreadyRequested: false };
const turn = (o: Record<string, unknown>): CloserTurn => parseCloserTurn(JSON.stringify({ reply: "تمام", ...o }))!;

describe("شروط build_request (بيانية فقط)", () => {
  it("تكتمل المجالات الخمسة فيمر", () => {
    expect(AREAS.every((a) => areaCovered(a, full))).toBe(true);
    expect(checkAction("build_request", ready)).toEqual({ ok: true });
  });
  it("الاسم مطلوب دائماً ولا يُستغنى عنه برفض", () => {
    const r = checkAction("build_request", { ...ready, lead: { ...full, storeName: undefined }, declined: ["products", "look", "selling", "contact"] });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toContain("النشاط والهوية");
    expect(parseDeclined(["identity", "products"])).toEqual(["products"]);
  });
  it("مجال ناقص يرفض الفعل، ورفض العميل الصريح يقبله", () => {
    const partial = { ...ready, lead: { storeName: "نور", niche: "ملابس", whatsapp: "01012345678" } };
    const no = checkAction("build_request", partial);
    expect(no.ok).toBe(false);
    expect(!no.ok && no.reason).toMatch(/المنتجات.*الشكل.*البيع والتوصيل/);
    expect(checkAction("build_request", { ...partial, declined: ["products", "look", "selling"] })).toEqual({ ok: true });
    expect(openAreas(partial.lead, ["products"])).toEqual(["look", "selling"]);
  });
  it("البريد وحده يكفي للتواصل، وبلا بريد ولا واتساب يلزم الرفض", () => {
    expect(areaCovered("contact", { email: "a@gmail.com" })).toBe(true);
    expect(areaCovered("contact", {})).toBe(false);
    expect(checkAction("build_request", { ...ready, lead: { ...full, whatsapp: undefined } }).ok).toBe(false);
    expect(checkAction("build_request", { ...ready, lead: { ...full, whatsapp: undefined }, declined: ["contact"] }).ok).toBe(true);
  });
  it("لا طلب بناء لخدمة أخرى ولا مرة ثانية للمحادثة نفسها", () => {
    const o = checkAction("build_request", { ...ready, otherService: true });
    expect(o.ok).toBe(false);
    expect(!o.ok && o.reason).toContain("خدمة أخرى");
    const dup = checkAction("build_request", { ...ready, alreadyRequested: true });
    expect(dup.ok).toBe(false);
    expect(!dup.ok && dup.reason).toContain("أُنشئ");
  });
  it("الأفعال الأخرى بلا شروط، وأفعال V4 القديمة صارت none", () => {
    expect(checkAction("none", { ...ready, lead: {} }).ok).toBe(true);
    expect(checkAction("ignore", { ...ready, lead: {} }).ok).toBe(true);
    expect(checkAction("other_service", { ...ready, otherService: true }).ok).toBe(true);
    expect(parseCloserTurn('{"reply":"تمام","action":"golden_link"}')?.action).toBe("none");
    expect(parseCloserTurn('{"reply":"تمام","action":"close_done"}')?.action).toBe("none");
  });
});

describe("مراجعة الدور", () => {
  const base = { replyCtx, recentAssistant: ["أهلاً بكم"], action: ready };
  it("دور سليم يمر، وignore يمر بلا رد", () => {
    expect(reviewTurn(turn({ reply: "السعر 999 ج بدلاً من 4,999 ج، وباقي 9 مقاعد." }), base)).toBeNull();
    expect(reviewTurn(turn({ reply: "", action: "ignore" }), base)).toBeNull();
  });
  it("سعر أو عدد مقاعد أو وعد ممنوع يرجع ملاحظة guard", () => {
    expect(reviewTurn(turn({ reply: "بـ 500 جنيه فقط" }), base)?.kind).toBe("guard");
    expect(reviewTurn(turn({ reply: "باقي 2 مقاعد فقط" }), base)?.kind).toBe("guard");
    expect(reviewTurn(turn({ reply: "ادفعوا الآن عبر رابط الحجز" }), base)?.kind).toBe("guard");
    expect(reviewTurn(turn({ reply: "المعاينة مجانية 24 ساعة ولا دفع إلا بعد الإعجاب" }), base)).toBeNull();
  });
  it("فعل غير مسموح يرجع ملاحظة action تطلب none", () => {
    const r = reviewTurn(turn({ action: "build_request" }), { ...base, action: { ...ready, lead: { storeName: "نور" } } });
    expect(r?.kind).toBe("action");
    expect(r?.note).toContain('action = "build_request"');
  });
  it("تكرار الرد حرفياً يُرفض إلا عند طلب موظف", () => {
    expect(reviewTurn(turn({ reply: "أهلاً  بكم" }), base)?.kind).toBe("repeat");
    expect(reviewTurn(turn({ reply: "أهلاً بكم", requestHuman: "شكوى" }), base)).toBeNull();
  });
});

describe("رسالة الإغلاق الثابتة وبيانات الطلب", () => {
  it("المقاعد والمدة بصيغ صحيحة", () => {
    expect([1, 2, 5, 12].map(seatsPhrase)).toEqual(["مقعد واحد", "مقعدان", "5 مقاعد", "12 مقعداً"]);
    expect([1, 2, 6, 24, 48, 72, 96].map(windowPhrase)).toEqual(["ساعة", "ساعتين", "6 ساعات", "24 ساعة", "يومين", "3 أيام", "4 أيام"]);
  });
  it("الإغلاق: متجر مخصص مجاني ورابط إعداد خلال المدة ولا دفع إلا بعد الإعجاب، بلا رابط ولا طلب دفع", () => {
    const m = buildRequestMessage("  شكراً لكم، سجلنا كل التفاصيل.  ", { windowHours: 48, offer: goldenOffer });
    expect(m.startsWith("شكراً لكم، سجلنا كل التفاصيل.\n\n")).toBe(true);
    expect(m).toContain("متجراً مخصصاً مجاناً");
    expect(m).toContain("رابط الإعداد هنا خلال يومين");
    expect(m).toContain("لا دفع إلا إن أعجبكم المتجر");
    expect(m).toContain("999 ج بدلاً من 4,999 ج");
    expect(m).toContain("باقي 9 مقاعد");
    expect(m).not.toMatch(/https?:|ادفعوا|حولوا|رابط الحجز/);
  });
  it("بلا مقاعد: السعر العادي بلا عدّاد ولا ندرة، وبلا سعر معروف يسقط السطر", () => {
    const m = buildRequestMessage("", { windowHours: 24, offer: { golden: false, seatsLeft: 0, seatsTotal: 10, price: 999, regular: 4999 } });
    expect(m).toContain("4,999 ج");
    expect(m).not.toMatch(/الذهبية|مقعد|بدلاً من/);
    expect(m.startsWith("الفريق سيجهز")).toBe(true);
    expect(priceLine({ golden: false, seatsLeft: 0, seatsTotal: 0, price: null, regular: null })).toBe("");
  });
  it("بيانات الطلب منظمة: الإجابات والمرفوض والعرض والملاحظات", () => {
    const d = buildRequestData({ lead: { storeName: "نور", niche: "ملابس", instagram: "nour", products: "صفحة جاهزة", whatsapp: "01012345678" }, declined: ["look", "selling"], offer: goldenOffer, notes: "  عميل\nمهتم  " });
    expect(d).toMatchObject({ v: 5, channel: "chat", offer: "golden", identity: { storeName: "نور", instagram: "nour" }, products: { text: "صفحة جاهزة", declined: false }, look: { text: null, declined: true }, selling: { declined: true }, contact: { whatsapp: "01012345678", email: null }, notes: "عميل مهتم" });
    expect(buildRequestData({ lead: { storeName: "س" }, declined: [], offer: { golden: false }, notes: "" }).offer).toBe("regular");
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
    const d = buildRequestMail({ name: "علي", channel: "instagram", lead: { storeName: "نور", niche: "ملابس", products: "صور على الموبايل", email: "a@gmail.com" }, code: "REQ-7K3M9", golden: true, windowHours: 48 });
    expect(d.subject).toContain("نور");
    expect(d.subject).toContain("REQ-7K3M9");
    expect(d.adminNote).toContain("طلب بناء جديد");
    const body = d.paragraphs.join("\n");
    expect(body).toContain("a@gmail.com");
    expect(body).toContain("صور على الموبايل");
    expect(body).toContain("الدائرة الذهبية");
    expect(body).toContain("لم يُطلب منه أي دفع");
  });
});

describe("حالة المحادثة المُلحقة بالتعليمات", () => {
  const base: StateInput = { replies: 0, channel: "instagram", lead: {}, invalid: {}, declined: [], summary: "", offer: { golden: true, seatsLeft: 9, seatsTotal: 10 }, requested: false, otherService: false, idleHours: null };
  it("أول رد، والعدّاد الحقيقي، وما لم يُغطَّ من المجالات", () => {
    const b = stateBlock(base);
    expect(b).toContain("هذا أول رد");
    expect(b).toContain("والباقي فعلاً 9 مقاعد من 10");
    expect(b).toContain("لم يُغطَّ بعد:");
    expect(b).toContain("المنتجات (أين هي");
    expect(b).not.toContain("رابط الحجز");
  });
  it("المقاعد المنتهية: لا ذهبية ولا ندرة", () => {
    const b = stateBlock({ ...base, offer: { golden: false, seatsLeft: 0, seatsTotal: 10 } });
    expect(b).toContain("مقاعد الدائرة الذهبية انتهت");
    expect(b).not.toContain("والباقي فعلاً");
  });
  it("اكتمال المجالات (أو الرفض) يأمر بتنفيذ build_request", () => {
    const b = stateBlock({ ...base, replies: 3, lead: full, declined: [] });
    expect(b).toContain('action = "build_request"');
    expect(b).not.toContain("هذا أول رد");
    const partial = stateBlock({ ...base, lead: { storeName: "نور", whatsapp: "01012345678" }, declined: ["products", "look", "selling"] });
    expect(partial).toContain('action = "build_request"');
    expect(partial).toContain("المغطاة أو المرفوضة");
  });
  it("بعد إنشاء الطلب: لا طلب آخر", () => {
    const b = stateBlock({ ...base, lead: full, requested: true });
    expect(b).toContain("أُنشئ طلب البناء");
    expect(b).not.toContain("لم يُغطَّ بعد");
  });
  it("خدمة أخرى: لا سعر ولا طلب بناء، وطلب المتجر يُحوَّل لموظف", () => {
    const b = stateBlock({ ...base, otherService: true });
    expect(b).toContain("صُنّفت «خدمة أخرى");
    expect(b).toContain("requestHuman");
    expect(b).not.toContain("لم يُغطَّ بعد");
    expect(b).not.toContain("والباقي فعلاً");
  });
  it("أصل المحادثة: فريقنا بدأ برسالة تواصل، أو المحاور جاء بنفسه، أو غير معروف", () => {
    expect(stateBlock({ ...base, origin: "us" })).toContain("فريقنا هو من بدأ");
    expect(stateBlock({ ...base, origin: "them" })).toContain("بدأ المحادثة بنفسه");
    expect(stateBlock(base)).toContain("يصلح في الحالتين");
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

describe("حقائق V5 للوكيل", () => {
  it("معاينة مجانية 24 ساعة والسعر بعد الإعجاب، بلا استضافة أو اشتراك شهري أو أسماء أدوات", () => {
    const f = agentFactsText(goldenOffer);
    expect(f).toContain("24 ساعة");
    expect(f).toContain("لا دفع إلا إن أعجبه المتجر");
    expect(f).toContain("999 ج بدلاً من 4,999 ج");
    expect(f).toContain("المتبقي 9 من 10");
    expect(f).not.toMatch(/استضاف|باقة|اشتراك|groq|neon|cloudflare|vercel|imagekit/i);
    const r = agentFactsText({ golden: false, seatsLeft: 0, seatsTotal: 10, price: 999, regular: 4999 });
    expect(r).toContain("4,999 ج");
    expect(r).not.toMatch(/الذهبية|(?<![\d,])999 ج/);
  });
  it("الرد الذي يذكر الأسعار الحقيقية يمر، والمخترع يُرفض", () => {
    expect(replyProblem("بعد الإعجاب السعر 999 ج بدلاً من 4,999 ج", replyCtx)).toBeNull();
    expect(replyProblem("السعر 1,500 ج", replyCtx)).toMatch(/سعراً/);
    expect(replyProblem("جربوا الديمو https://demo.colapia.com", replyCtx)).toBeNull();
  });
});

describe("برومبت الوكيل V5", () => {
  it("يغطي المسارين والأفعال والمجالات الخمسة وحقول الرد ومتغيرات الحقائق", () => {
    for (const k of ["{{pricingFacts}}", "{{demoUrl}}", "{{qimaUrl}}", "{{otherNote}}", "build_request", "other_service", "ignore", "requestHuman", "declined", "النشاط والهوية", "المنتجات", "الشكل", "البيع والتوصيل", "التواصل"]) expect(CLOSER_V5_PROMPT).toContain(k);
  });
  it("لا طلب دفع ولا رابط حجز، ولا أدوات V4 القديمة", () => {
    expect(CLOSER_V5_PROMPT).toContain("لا تطلب دفعاً أبداً ولا ترسل رابط حجز");
    for (const k of ["golden_link", "close_done", "الدائرة الذهبية متاحة في حالة المحادثة"]) expect(CLOSER_V5_PROMPT).not.toContain(k);
  });
  it("لا أسماء تقنيات ولا إفصاح استباقي ولا ذكر لمتاجر إنستجرام", () => {
    expect(CLOSER_V5_PROMPT).not.toMatch(/\b(groq|neon|cloudflare|imagekit|gemini|openai|chatgpt)\b/i);
    expect(CLOSER_V5_PROMPT).not.toMatch(/instagram stores|متاجر إنستجرام/i);
    expect(CLOSER_V5_PROMPT).not.toContain("confirmCreate");
    expect(CLOSER_V5_PROMPT).toContain("لا تدّعِ أنك إنسان أبداً");
    expect(CLOSER_V5_PROMPT).toContain("لا تذكر ذلك من تلقاء نفسك");
  });
  it("مسجَّل بمفتاح closer.v5 الجديد وحده", () => {
    const d = readFileSync("src/ai/prompts.defaults.ts", "utf8");
    expect(d).toMatch(/"closer\.v5": CLOSER_V5_PROMPT/);
    expect(d).not.toMatch(/"closer\.v[34]"/);
    expect(readFileSync("src/ai/agents/closer/runtime.ts", "utf8")).toContain('getPrompt("closer.v5"');
  });
});
