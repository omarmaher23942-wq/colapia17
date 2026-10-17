// agent-probe.ts — يجرّب وكيل الرسائل V2 كاملاً محلياً (للتطوير فقط): قاعدة Postgres محلية حقيقية، وGraph API مُحاكى يسجّل ما
// يُرسل، ونموذج مُحاكى مبرمج (بلا مفاتيح حقيقية) يتبع سيناريو: جمع البيانات الأربع ثم الموافقة ← إنشاء المتجر بحالة setup
// وجدولة رابط الإعداد. يطبع كل محادثة كما رآها العميل ثم يتحقق من القاعدة.
// الاستخدام: bash scripts/dev/preview.sh run node --require ./scripts/dev/no-server-only.cjs --import tsx scripts/dev/agent-probe.ts
process.env.META_PAGE_ACCESS_TOKEN = "EAAdevprobe";
process.env.META_PAGE_ID = "111";
process.env.META_APP_ID = "222";
process.env.META_APP_SECRET = "dev";
process.env.META_VERIFY_TOKEN = "dev";
process.env.PROBE_FAKE_AI = "1";

type Sent = { to: string; text: string; button?: string; quick?: string[] };
const sent: Sent[] = [];
let seq = 0;
const realFetch = globalThis.fetch;

/** سيناريو النموذج المُحاكى: يقرأ آخر رسالة للعميل ويرد بدور JSON صالح (reply, memory, lead, confirmCreate). */
function scriptedTurn(lastUser: string): Record<string, unknown> {
  const t = lastUser.trim();
  if (/ابدأ|نبدأ|موافق|تمام/.test(t)) return { reply: "ممتاز، نبدأ التجهيز.", memory: "وافق على البدء", requestHuman: null, lead: {}, confirmCreate: true };
  if (/01\d{9}/.test(t)) return { reply: "وصلنا الرقم. نبدأ تجهيز المتجر الآن؟", memory: "كل البيانات جاهزة", requestHuman: null, lead: { whatsapp: t.match(/01\d{9}/)![0] }, confirmCreate: false };
  if (/@/.test(t)) return { reply: "وصلنا البريد. ما رقم واتساب المتجر؟", memory: "أعطى البريد", requestHuman: null, lead: { email: t.match(/[\w.+-]+@[\w.-]+\.\w+/)![0] }, confirmCreate: false };
  if (/اسم/.test(t)) return { reply: "اسم جميل. ما بريد Google الذي ستدخلون به إلى لوحة المتجر؟", memory: "أعطى الاسم", requestHuman: null, lead: { storeName: "نور" }, confirmCreate: false };
  return { reply: "أهلاً بكم. نجهّز لكم متجراً احترافياً بلوحة واحدة للطلبات وتجربة مجانية قبل الدفع. ما اسم المتجر؟", memory: "براند ملابس", requestHuman: null, lead: { niche: "ملابس رجالي" }, confirmCreate: false };
}

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
        quick: body.message.quick_replies?.map((q: { title: string }) => q.title),
      });
      return new Response(JSON.stringify({ recipient_id: body.recipient?.id, message_id: `m_probe_${++seq}` }), { status: 200 });
    }
    return new Response(JSON.stringify({ name: "Probe", username: "probe_brand", result: "ok" }), { status: 200 });
  }
  // نموذج Gemini يفشل فوراً (مفاتيح وهمية) فينتقل الوكيل إلى Groq المُحاكى.
  if (/generativelanguage\.googleapis\.com/.test(url)) return new Response(JSON.stringify({ error: { message: "probe: no key" } }), { status: 400 });
  if (/api\.groq\.com/.test(url)) {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const msgs: { role: string; content: string }[] = body.messages ?? [];
    const lastUser = [...msgs].reverse().find((m) => m.role === "user")?.content ?? "";
    const reply = JSON.stringify(scriptedTurn(typeof lastUser === "string" ? lastUser : ""));
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
  const { conversations, stores, scheduledJobs, merchants } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");

  let n = 0;
  async function say(userId: string, text: string) {
    const before = sent.length;
    console.log(`\n  العميل: ${text}`);
    await handleInbound("instagram", userId, [{ mid: `mid_${++n}`, text, attachments: [], timestamp: Date.now() }]);
    const replies = sent.slice(before).filter((s) => s.to === userId);
    if (!replies.length) console.log("  (لا رد)");
    for (const r of replies) console.log(`  الوكيل: ${r.text}${r.quick ? `\n          [أزرار سريعة] ${r.quick.join(" | ")}` : ""}`);
  }

  const run = Date.now().toString(36);
  const userId = `probe_${run}_a`;
  console.log("\n══ سيناريو: جمع البيانات ثم الموافقة ← إنشاء المتجر ══");
  for (const line of ["عندي براند ملابس رجالي على انستجرام", "اسم المتجر نور", "بريدي omar.probe@gmail.com", "واتساب 01012345678", "نبدأ"]) await say(userId, line);

  const [conv] = await db.select().from(conversations).where(and(eq(conversations.channel, "instagram"), eq(conversations.externalId, userId)));
  const lead = (conv?.memory as { lead?: Record<string, unknown> } | null)?.lead;
  console.log("\n  — الذاكرة المجموعة:", JSON.stringify(lead));
  if (!conv?.storeId) throw new Error("لم يُنشأ متجر من المحادثة");
  const [store] = await db.select().from(stores).where(eq(stores.id, conv.storeId));
  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, store!.merchantId));
  const jobs = await db.select({ kind: scheduledJobs.kind, runAt: scheduledJobs.runAt }).from(scheduledJobs).where(eq(scheduledJobs.storeId, store!.id));
  console.log(`  — المتجر: ${store!.subdomain} حالة=${store!.status} | التاجر: ${merchant?.email} (canonical=${merchant?.emailCanonical})`);
  console.log(`  — المهام المجدولة: ${jobs.map((j) => j.kind).sort().join("، ")}`);
  if (store!.status !== "setup") throw new Error("حالة المتجر يجب أن تكون setup");
  if (jobs.length < 4) throw new Error("مهام الإعداد لم تُجدول كاملة");
  const ack = sent.filter((s) => s.to === userId).some((s) => s.text.includes("جمعنا كل المعلومات"));
  if (!ack) throw new Error("رد الإنشاء من الكود لم يُرسل");

  // تكرار نفس الرسالة بعد الإنشاء لا ينشئ متجراً ثانياً.
  await say(userId, "نبدأ");
  const count = await db.select({ id: stores.id }).from(stores).where(eq(stores.sourceConversationId, conv.id));
  if (count.length !== 1) throw new Error(`يجب أن يبقى متجر واحد للمحادثة، وُجد ${count.length}`);
  console.log("\nتم: متجر واحد، حالة setup، مهام الإعداد مجدولة.");
}

void main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
