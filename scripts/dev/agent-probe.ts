// agent-probe.ts — يجرّب وكيل الرسائل كاملاً محلياً (للتطوير فقط): قاعدة Postgres محلية حقيقية، وGraph API مُحاكى يسجّل
// ما يُرسل، ومفاتيح الذكاء الاصطناعي وهمية فتفشل فتعمل القواعد الاحتياطية. يطبع كل محادثة كما رآها العميل.
// الاستخدام: bash scripts/dev/preview.sh run node --require ./scripts/dev/no-server-only.cjs --import tsx scripts/dev/agent-probe.ts
process.env.META_PAGE_ACCESS_TOKEN = "EAAdevprobe";
process.env.META_PAGE_ID = "111";
process.env.META_APP_ID = "222";
process.env.META_APP_SECRET = "dev";
process.env.META_VERIFY_TOKEN = "dev";

type Sent = { to: string; text: string; button?: string };
const sent: Sent[] = [];
let seq = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url);
  if (/graph\.(facebook|instagram)\.com/.test(url)) {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (body.message) {
      const tpl = body.message.attachment?.payload;
      sent.push({
        to: body.recipient?.id,
        text: tpl?.text ?? body.message.text ?? "",
        button: tpl?.buttons?.[0] ? `${tpl.buttons[0].title} -> ${tpl.buttons[0].url}` : undefined,
      });
      return new Response(JSON.stringify({ recipient_id: body.recipient?.id, message_id: `m_probe_${++seq}` }), { status: 200 });
    }
    return new Response(JSON.stringify({ name: "Probe", result: "ok" }), { status: 200 });
  }
  // PROBE_FAKE_AI=1: نموذج Groq مُحاكى يرد بـ JSON صالح، لإثبات مسار الإرسال كاملاً (الذكاء الاصطناعي ← Meta) بلا مفاتيح.
  if (process.env.PROBE_FAKE_AI === "1" && /api\.groq\.com/.test(url)) {
    const reply = JSON.stringify({ thinking: "-", reply: `رد تجريبي رقم ${++seq}`, issueLink: false, memory: "تجربة" });
    return new Response(
      JSON.stringify({ id: "x", object: "chat.completion", created: 0, model: "fake", choices: [{ index: 0, message: { role: "assistant", content: reply }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }
  return realFetch(input, init);
}) as typeof fetch;

async function main() {
  const { handleInbound } = await import("@/ai/agents/closer/runtime");
  const { db } = await import("@/db/client");
  const { conversations } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");

  let n = 0;
  async function scenario(title: string, userId: string, lines: string[]) {
    console.log(`\n══ ${title} ══`);
    for (const text of lines) {
      const before = sent.length;
      console.log(`\n  العميل: ${text}`);
      await handleInbound("instagram", userId, [{ mid: `mid_${++n}`, text, attachments: [], timestamp: Date.now() }]);
      const replies = sent.slice(before).filter((s) => s.to === userId);
      if (!replies.length) console.log("  (لا رد)");
      for (const r of replies) console.log(`  الوكيل: ${r.text}${r.button ? `\n          [زر] ${r.button}` : ""}`);
    }
    const [c] = await db.select().from(conversations).where(and(eq(conversations.channel, "instagram"), eq(conversations.externalId, userId)));
    console.log(`  — الحالة: stage=${c?.stage} botPaused=${c?.botPaused}`);
  }

  const run = Date.now().toString(36);
  await scenario("1) تحية ثم تفاصيل مكررة ثم سعر ثم طلب الرابط", `probe_${run}_a`, ["هاي", "ممكن تفاصيل", "ممكن تفاصيل", "بكام", "ابعتلي الفورم", "شكرا"]);
  await scenario("2) السؤال عن البوت: جواب صادق بلا تحويل", `probe_${run}_b`, ["هاي", "انت بوت ولا انسان؟", "طيب بتعملوا ايه"]);
  await scenario("3) طلب موظف: تحويل ثم صمت", `probe_${run}_c`, ["بكام", "عايز اكلم موظف", "طيب رد عليا"]);
  await scenario("4) ذكر النشاط: الزر مرة واحدة", `probe_${run}_d`, ["عندي براند ملابس على انستجرام", "وبتشحنوا ازاي", "ليه المتجر احسن من الدايركت؟"]);
  await scenario("5) كلمات تشبه «بوت» ليست سؤالاً عنه", `probe_${run}_e`, ["عندي بوتيك ولا لا", "ابعتلي email ولا واتساب"]);
  console.log("\nتم.");
}

void main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
