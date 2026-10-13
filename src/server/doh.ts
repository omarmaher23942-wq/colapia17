import "server-only";
// doh.ts — استعلام DNS عبر HTTPS (Cloudflare 1.1.1.1، صيغة JSON). يعمل على أي استضافة (Cloudflare Workers بلا node:dns
// كامل، وNode، وVercel) فلا يرتبط الفحص بمزود. null = تعذر الاستعلام (لا «لا سجلات»).
export type DohAnswer = { type: number; data: string };

export const DNS_TYPE = { A: 1, CNAME: 5, AAAA: 28 } as const;

export async function dohQuery(name: string, type: "A" | "AAAA"): Promise<DohAnswer[] | null> {
  try {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!r.ok) return null;
    const body = (await r.json()) as { Status?: number; Answer?: DohAnswer[] };
    // 0 = وُجد، 3 = النطاق غير موجود (NXDOMAIN): كلاهما نتيجة صحيحة. غير ذلك = تعذر الفحص.
    if (body.Status !== 0 && body.Status !== 3) return null;
    return body.Answer ?? [];
  } catch {
    return null;
  }
}

/** كل عناوين المضيف (A وAAAA بعد سلسلة CNAME). */
export async function resolveAddresses(host: string): Promise<string[]> {
  const [a, aaaa] = await Promise.all([dohQuery(host, "A"), dohQuery(host, "AAAA")]);
  return [...(a ?? []), ...(aaaa ?? [])].filter((x) => x.type === DNS_TYPE.A || x.type === DNS_TYPE.AAAA).map((x) => x.data);
}
