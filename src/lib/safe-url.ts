// safe-url.ts — رابط https صالح من نص يكتبه الفريق أو العميل (روابط المستودع والمتجر). يضيف https:// لما يُكتب بلا بروتوكول،
// ويرفض أي بروتوكول آخر (javascript:, http:, data:) والبيانات المضمَّنة في الرابط (user:pass@). خالص ومختبَر.
export function safeUrl(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s || s.length > 300 || /\s/.test(s)) return null;
  const withProto = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    if (!u.hostname.includes(".") || u.hostname.endsWith(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}
