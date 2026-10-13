// قواعد رد الوكيل الاحتياطية (حين يتعذر الذكاء الاصطناعي): تقرأ النية، لا تكرر، لا تفصح من تلقاء نفسها، ولا تعيد الرابط بلا طلب.
import { describe, expect, it } from "vitest";
import { intentsOf, ruleReply, type RuleContext } from "@/ai/agents/closer/replies";
import { LINK_REPEAT_MS } from "@/ai/agents/closer/policy";

const vars = { priceLine: "2,499 جنيه", renewal: "1299", trialHours: "24", remainingLine: "باقٍ 3 متاجر فقط بهذا السعر. " };
const NOW = 1_800_000_000_000;

type Turn = { role: "user" | "assistant"; text: string };

/** يحاكي محادثة: كل رسالة عميل تُجاب بالقواعد، وتُضاف الردود للسجل كما يفعل الوكيل. */
function chat(messages: string[], opts: { linkSentAt?: number | null } = {}) {
  const history: Turn[] = [];
  let linkSentAt = opts.linkSentAt ?? null;
  const out: { user: string; reply: string; link: boolean; human?: string }[] = [];
  for (const text of messages) {
    const ctx: RuleContext = { text, history: [...history], linkSentAt, now: NOW, vars };
    const r = ruleReply(ctx);
    out.push({ user: text, reply: r.reply, link: r.issueLink, human: r.requestHuman });
    history.push({ role: "user", text }, { role: "assistant", text: r.issueLink ? `${r.reply}\n[زر الاستمارة: ابدأ -> https://x]` : r.reply });
    if (r.issueLink) linkSentAt = NOW;
    if (r.requestHuman) break; // المحادثة حُوّلت لموظف: يتوقف الوكيل
  }
  return out;
}

describe("نية الرسالة", () => {
  it.each([
    ["هاي", "greeting"],
    ["hi", "greeting"],
    ["السلام عليكم", "greeting"],
    ["ممكن تفاصيل", "details"],
    ["بكام الباقة؟", "price"],
    ["ابعتلي الفورم", "start"],
    ["يلا نبدأ", "start"],
    ["انتو نصابين ولا مضمونين", "trust"],
    ["شكرا", "thanks"],
    ["هفكر وارد عليك", "later"],
    ["عندي براند ملابس", "business"],
    ["عندي بوتيك ولا لا", "business"],
    ["وبتشحنوا ازاي", "shipping"],
    ["التوصيل لكل المحافظات؟", "shipping"],
    ["طرق الدفع ايه", "payment"],
    ["فودافون كاش ينفع", "payment"],
    ["هتسلموا امتى", "timing"],
    ["ليه المتجر احسن من الدايركت؟", "why"],
    ["ينفع دومين خاص", "domain"],
    ["عندكم امثله لشغل سابق", "example"],
    ["عندي مطعم", "nonProduct"],
    ["ؤؤؤ", "unclear"],
  ] as const)("%s ← %s", (text, intent) => {
    expect(intentsOf(text)).toContain(intent);
  });
  it("رسالة تحمل نيتين: «هاي بكام؟»", () => {
    const i = intentsOf("هاي بكام؟");
    expect(i).toContain("price");
    expect(i).toContain("greeting");
    expect(i[0]).toBe("price");
  });
});

describe("لا يُساء فهم رسائل لا علاقة لها بالبدء", () => {
  it.each(["ابعتلي email ولا واتساب", "عندي سؤال", "تمام"])("%s ليست طلب بدء ولا نشاطاً", (t) => {
    const i = intentsOf(t);
    expect(i).not.toContain("start");
    expect(i).not.toContain("business");
  });
});

describe("أسئلة محددة تُجاب من حقائق المنتج", () => {
  it("الشحن والدفع والموعد والفرق والدومين: رد خاص بكل سؤال بلا رابط", () => {
    const r = chat(["وبتشحنوا ازاي", "طرق الدفع ايه", "هتسلموا امتى", "ليه المتجر احسن من الدايركت", "ينفع دومين خاص"]);
    expect(r[0]!.reply).toContain("الشحن");
    expect(r[1]!.reply).toMatch(/فودافون كاش|إنستاباي/);
    expect(r[2]!.reply).toContain("الاستمارة");
    expect(r[3]!.reply).toContain("لوحة واحدة");
    expect(r[4]!.reply).toContain("دومين");
    expect(r.map((x) => x.link)).toEqual([false, false, false, false, false]);
  });
  it("لا موعد محدد ولا أمثلة مخترعة", () => {
    const r = chat(["هتسلموا امتى", "عندكم امثله لشغل سابق"]);
    expect(r[0]!.reply).not.toMatch(/\d+\s*(?:يوم|ايام|أيام)/);
    expect(r[1]!.reply).not.toMatch(/عملاء|عملنا|نفذنا/);
  });
  it("نشاط غير المتاجر: اعتذار صادق بلا وعد", () => {
    const [a] = chat(["عندي مطعم"]);
    expect(a!.reply).toContain("مش متاح");
    expect(a!.link).toBe(false);
  });
  it("السؤال نفسه مرتين: صيغتان مختلفتان ثم تحويل لموظف بدل التكرار", () => {
    const r = chat(["وبتشحنوا ازاي", "وبتشحنوا ازاي", "وبتشحنوا ازاي", "وبتشحنوا ازاي"]);
    expect(r[0]!.reply).not.toBe(r[1]!.reply);
    expect(r.some((x) => x.human)).toBe(true);
  });
});

describe("لا تكرار", () => {
  it("«ممكن تفاصيل» ثلاث مرات: ثلاث صيغ مختلفة ثم عرض موظف", () => {
    const r = chat(["ممكن تفاصيل", "ممكن تفاصيل", "ممكن تفاصيل", "ممكن تفاصيل"]);
    const replies = r.map((x) => x.reply);
    expect(new Set(replies.slice(0, 3)).size).toBe(3);
    expect(replies[3]).not.toBe(replies[0]);
    expect(replies[3]).not.toBe(replies[1]);
    expect(replies[3]).not.toBe(replies[2]);
  });
  it("لا رد يتكرر حرفياً عبر محادثة طويلة من نفس الأسئلة", () => {
    const r = chat(["هاي", "ممكن تفاصيل", "بكام", "بكام", "تفاصيل اكتر", "تفاصيل اكتر", "مش فاهم", "مش فاهم", "؟؟", "؟؟"]);
    // الردّ المقترن بتحويل لموظف لا يُرسل أصلاً (يُرسَل بدله ردّ التحويل)، فلا يدخل في المقارنة.
    const replies = r.filter((x) => !x.human).map((x) => x.reply);
    for (let i = 1; i < replies.length; i++) expect(replies[i]).not.toBe(replies[i - 1]);
    expect(r.some((x) => x.human)).toBe(true);
  });
  it("من يعيد أسئلته بعد نفاد الصيغ يُحوَّل لموظف بدل التكرار", () => {
    const r = chat(Array.from({ length: 9 }, () => "ممكن تفاصيل"));
    expect(r.some((x) => x.human)).toBe(true);
  });
});

describe("لا إفصاح استباقي", () => {
  it("لا ذكر لكلمة بوت أو آلي أو مساعد أو ذكاء في أي صيغة", () => {
    const r = chat(["هاي", "ممكن تفاصيل", "بكام", "انتو نصابين", "ابعت الفورم", "شكرا", "هفكر", "عندي محل ملابس", "؟؟"]);
    for (const x of r) expect(x.reply).not.toMatch(/بوت|آلي|الي\b|مساعد|ذكاء|روبوت/);
  });
});

describe("الرابط", () => {
  it("لا يُرسل في التحية ولا في طلب التفاصيل", () => {
    const r = chat(["هاي", "ممكن تفاصيل"]);
    expect(r.map((x) => x.link)).toEqual([false, false]);
  });
  it("يُرسل عند طلب صريح، ويُعاد لأنه طلبه", () => {
    const r = chat(["ابعتلي الفورم", "ابعتلي الفورم تاني"]);
    expect(r.map((x) => x.link)).toEqual([true, true]);
    expect(r[0]!.reply).not.toBe(r[1]!.reply);
  });
  it("أول مرة يذكر نشاطه: يُرسل مرة، ولا يتكرر في الرسائل التالية بلا طلب", () => {
    const r = chat(["عندي براند ملابس", "عندي كمان احذية", "طيب والتوصيل"]);
    expect(r[0]!.link).toBe(true);
    expect(r[1]!.link).toBe(false);
    expect(r[2]!.link).toBe(false);
  });
  it("السعر لا يرسل الزر فوراً، وفي المرة الثانية يعرضه لمن لم يصله", () => {
    const r = chat(["بكام", "بكام برضه"]);
    expect(r[0]!.link).toBe(false);
    expect(r[1]!.link).toBe(true);
  });
  it("إن أُرسل الزر قبل قليل لا يعاد بلا طلب", () => {
    const r = ruleReply({ text: "عندي محل شنط", history: [{ role: "assistant", text: "تمام" }], linkSentAt: NOW - LINK_REPEAT_MS / 2, now: NOW, vars });
    expect(r.issueLink).toBe(false);
  });
});

describe("المحتوى", () => {
  it("السعر والتجديد والتجربة من المتغيرات فقط", () => {
    const [a, b] = chat(["بكام", "بكام"]);
    expect(a!.reply).toContain("2,499 جنيه");
    expect(a!.reply).toContain("24 ساعة");
    expect(b!.reply).toContain("1299");
  });
  it("لا أرقام مخترعة ولا إيموجي", () => {
    const all = chat(["هاي", "ممكن تفاصيل", "بكام", "انتو نصابين", "ابعت الفورم", "شكرا", "هفكر", "عندي محل ملابس", "؟؟"]).map((x) => x.reply).join(" ");
    const numbers = all.match(/\d[\d,]*/g) ?? [];
    for (const n of numbers) expect(["2,499", "1299", "24", "3", "6"]).toContain(n);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it("قصيرة: لا رد يتجاوز 300 حرف", () => {
    const r = chat(["هاي", "ممكن تفاصيل", "ممكن تفاصيل", "ممكن تفاصيل", "بكام", "بكام", "انتو نصابين", "انتو نصابين"]);
    for (const x of r) expect(x.reply.length).toBeLessThanOrEqual(300);
  });
  it("لغة تصلح للجميع: لا صيغ مؤنث حصرية ولا عامية مذكر صريحة", () => {
    const all = chat(["هاي", "ممكن تفاصيل", "ممكن تفاصيل", "ممكن تفاصيل", "بكام", "بكام", "انتو نصابين", "انتو نصابين", "ابعت الفورم", "ابعت الفورم", "شكرا", "هفكر", "عندي محل ملابس", "؟؟", "؟؟"]).map((x) => x.reply).join(" ");
    for (const w of ["دوّري", "جرّبي", "اختاري", "عايز", "معاك", "استنى", "سيبها", "متأكد", "العميلة"]) expect(all).not.toContain(w);
  });
});
