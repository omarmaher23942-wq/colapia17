// state.ts — «حالة المحادثة» التي تُلحق بتعليمات الوكيل في كل دور (خالص ومختبَر): ما جُمع وما نقص وما خطؤه، وما ذُكر،
// وهل أُنشئ المتجر. الترتيب ثابت: النشاط، اسم المتجر، البريد، واتساب (الإنستجرام يُلتقط تلقائياً).
import { LEAD_FIELDS, leadStatus, type Lead, type LeadField, type LeadInvalid } from "./lead";
import type { Mentions } from "./offers";

const LABEL: Record<LeadField, string> = {
  niche: "نشاطه (ماذا يبيع)",
  storeName: "اسم المتجر",
  email: "بريد Google الذي سيدخل به إلى لوحة متجره",
  whatsapp: "رقم واتساب المتجر",
};

export type StateInput = {
  replies: number;
  channel: "messenger" | "instagram";
  lead: Lead;
  invalid: LeadInvalid;
  mentions: Mentions;
  storeExists: boolean;
  /** صور أرسلها في المحادثة. */
  imagesReceived: number;
  summary: string;
  goldenAvailable: boolean;
};

const show = (f: LeadField, lead: Lead) => `${LABEL[f]}: ${lead[f]}`;

export function stateBlock(i: StateInput): string {
  const st = leadStatus(i.lead, i.invalid);
  const lines: string[] = ["", "# حالة هذه المحادثة (للعلم، لا تذكرها في ردك):"];
  lines.push(`- ردودك السابقة: ${i.replies}${i.replies === 0 ? " (هذا أول رد)" : " (لا ترحب ولا تعرّف بنفسك مجدداً)"}`);

  if (i.storeExists) {
    lines.push("- المتجر أُنشئ بالفعل لهذا العميل وسيصله رابط الإعداد. لا تجمع بيانات ولا تنشئ شيئاً؛ أجب عن أسئلته فقط واطمئنه، وإن سأل عن الرابط فهو يصله قريباً هنا وعلى بريده.");
  } else {
    lines.push(
      st.collected.length ? `- جُمع وتحقق منه الكود: ${st.collected.map((f) => show(f, i.lead)).join("، ")}` : "- لم يُجمع شيء بعد.",
      st.missing.length ? `- الناقص بالترتيب: ${st.missing.map((f) => LABEL[f]).join(" ثم ")}. اسأل عن **الأول فقط** وبعد أن تكون قد أعطيته قيمة.` : "- كل البيانات جُمعت وصحت. اطلب منه موافقة واضحة على بدء تجهيز المتجر، وعند موافقته فقط اجعل confirmCreate = true.",
      st.invalid.length ? `- قيم أرسلها ولم تُقبل (اطلب تصحيحها بلطف دون لوم): ${st.invalid.map((f) => `${LABEL[f]} («${i.invalid[f]}» غير صالح)`).join("، ")}` : "",
      i.lead.instagram ? `- حساب إنستجرام معروف: @${i.lead.instagram} (لا تسأل عنه)` : i.channel === "messenger" ? "- حساب إنستجرام غير معروف (اختياري: اسأل عنه فقط في نهاية جمع البيانات إن لم يذكره)." : "",
    );
  }
  lines.push(
    `- الرابط التجريبي (demo): ${i.mentions.demo ? "ذُكر سابقاً (لا تكرره إلا إن سأل)" : "لم يُذكر بعد: اذكره في الوقت المناسب"}`,
    i.goldenAvailable ? `- عرض الدائرة الذهبية: ${i.mentions.golden ? "ذُكر سابقاً (لا تكرره إلا إن سأل)" : "لم يُذكر بعد: اذكره بهدوء في الوقت المناسب"}` : "- عرض الدائرة الذهبية غير متاح الآن: لا تذكره.",
    i.imagesReceived ? `- أرسل ${i.imagesReceived} صورة في المحادثة وحُفظت لتظهر له في الإعداد؛ اشكره باختصار ولا تعدّد ما فيها.` : "",
    i.summary ? `- ذاكرتك عنه (من أدوارك السابقة، حدّثها في الحقل memory):\n${i.summary}` : "- ذاكرتك عنه: فارغة (ابدأ تدوينها في الحقل memory)."
  );
  return lines.filter((l) => l !== "").join("\n").replace(/^/, "\n");
}

/** الحقول بترتيب الجمع الثابت (للاختبار والواجهة). */
export const COLLECTION_ORDER: readonly LeadField[] = LEAD_FIELDS;
