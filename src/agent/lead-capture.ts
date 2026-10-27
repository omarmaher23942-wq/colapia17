// lead-capture.ts — «العميل المحتمل» (V6): ما يسجله الوكيل في ذاكرة المحادثة حين يترك العميل اسمه ورقمه. مصدر واحد لنوعه
// وعلامته ولما تقرؤه صفحة الليدز في لوحة المالك. خالص ومختبَر. لا جدول جديد: الليد جزء من memory.v6Lead.
export const LEAD_FLAG = "lead_captured";
export const LEAD_STATUSES = ["new", "contacted", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = { new: "جديد", contacted: "تم التواصل", won: "تم الاتفاق", lost: "لم يكتمل" };

export type LeadRecord = {
  name: string;
  whatsapp: string;
  email?: string;
  service: string;
  summary: string;
  igUsername?: string;
  at: string;
  status: LeadStatus;
  note?: string;
};

export const isLeadStatus = (v: unknown): v is LeadStatus => typeof v === "string" && (LEAD_STATUSES as readonly string[]).includes(v);

/** الليد المحفوظ في ذاكرة محادثة (أو null). */
export function leadRecordOf(memory: unknown): LeadRecord | null {
  const r = (memory as { v6Lead?: Partial<LeadRecord> } | null)?.v6Lead;
  if (!r || typeof r.name !== "string" || typeof r.whatsapp !== "string") return null;
  return {
    name: r.name,
    whatsapp: r.whatsapp,
    email: typeof r.email === "string" ? r.email : undefined,
    service: typeof r.service === "string" ? r.service : "",
    summary: typeof r.summary === "string" ? r.summary : "",
    igUsername: typeof r.igUsername === "string" ? r.igUsername : undefined,
    at: typeof r.at === "string" ? r.at : new Date(0).toISOString(),
    status: isLeadStatus(r.status) ? r.status : "new",
    note: typeof r.note === "string" ? r.note : undefined,
  };
}

/** رابط واتساب مباشر لرقم مصري محلي (01xxxxxxxxx). */
export const whatsappLink = (phone: string): string => `https://wa.me/${phone.replace(/\D/g, "").replace(/^0/, "20")}`;
