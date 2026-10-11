// /admin/requests/[id] — كل ما أرسله العميل كما هو (والمتروك للفريق معلَّم صراحة)، وصوره ورسالته الصوتية، ونقل
// المرحلة بملاحظة للعميل، والملاحظات الداخلية، وسجل كامل، وBRIEF.md جاهز للنسخ (نفس أقسام stores/_template).
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { AlertTriangle, ArrowRight, ExternalLink, Mail, MessageCircle } from "lucide-react";
import { db } from "@/db/client";
import { platformUsers } from "@/db/schema";
import { storeRequests } from "@/db/schema/agency";
import { isMissingTable, readData, requestAssets, requestEvents } from "@/intake/repo";
import { STAGE_INFO } from "@/intake/stages";
import { DELIVERY_OPTIONS, PAYMENT_OPTIONS, safeUrl, socialUrl } from "@/intake/schema";
import { paletteById } from "@/intake/palettes";
import { renderBrief } from "@/intake/brief";
import { requirePlatformPage } from "@/server/platform-guard";
import { waLink } from "@/lib/whatsapp";
import { isTrustedUploadUrl } from "@/lib/upload-hosts";
import { CopyBrief, DeleteRequest, NoteForm, SpamToggle, StageMover } from "@/components/platform/requests/RequestActions";
import { at, isGoogleMail, isLate, SOURCE_LABEL } from "@/components/platform/requests/format";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEAM = "سيبها للفريق";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-white/[0.06] py-2.5 last:border-0 sm:grid-cols-[160px_1fr]">
      <dt className="text-xs font-bold text-[#8d97c4]">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-bold text-[#eaf0ff]">{children}</dd>
    </div>
  );
}

const Muted = ({ children }: { children: React.ReactNode }) => <span className="font-medium text-[#8d97c4]">{children}</span>;
const Team = () => <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11.5px] font-black text-emerald-300">{TEAM}</span>;

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-[#8fa8ff] underline underline-offset-4" dir="ltr">
      {children}
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  );
}

const card = "rounded-3xl border border-white/10 bg-[#0b0f2a] p-4 sm:p-5";

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePlatformPage();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const canWrite = me.role !== "reviewer";

  let row: typeof storeRequests.$inferSelect | undefined;
  try {
    [row] = await db.select().from(storeRequests).where(eq(storeRequests.id, id)).limit(1);
  } catch (e) {
    if (isMissingTable(e)) notFound();
    throw e;
  }
  if (!row || row.status === "draft") notFound();

  const [assets, events, team] = await Promise.all([
    requestAssets(row.id),
    requestEvents(row.id),
    db.select({ id: platformUsers.id, name: platformUsers.name }).from(platformUsers),
  ]);
  // فتح الطلب يزيل شارة «جديد» من اللوحة.
  if (!row.seenAt) {
    await db.update(storeRequests).set({ seenAt: new Date(), seenBy: me.id }).where(and(eq(storeRequests.id, row.id), isNull(storeRequests.seenAt)));
  }

  const d = readData(row.data);
  const byKey = new Map(assets.map((a) => [a.key, a]));
  const url = (key?: string) => {
    const u = key ? byKey.get(key)?.url : undefined;
    return u && isTrustedUploadUrl(u) ? u : null;
  };
  const names = new Map(team.map((t) => [`platform:${t.id}`, t.name]));
  const actor = (a: string) => (a === "client" ? "العميل" : a === "system" ? "النظام" : (names.get(a) ?? "عضو فريق"));
  const palette = paletteById(d.colors.preset);
  const social = socialUrl(d.social.url);
  const inspiration = safeUrl(d.inspiration.url);
  const voice = d.voice.key ? byKey.get(d.voice.key) : undefined;
  const logo = url(d.logo.key);
  const late = isLate(row);
  const brief = renderBrief({ code: row.code, data: d, assets: assets.map((a) => ({ key: a.key, url: a.url, kind: a.kind, transcript: a.transcript })), submittedAt: row.submittedAt });
  const greet = `أهلاً، معاك فريق Colapia بخصوص طلب متجر «${row.storeName ?? ""}» (${row.code}).`;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/admin/requests" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8d97c4] hover:text-white">
        <ArrowRight className="size-4" aria-hidden="true" /> كل الطلبات
      </Link>

      <header className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs font-black text-[#8fa8ff]">{row.code}</p>
            <h1 className="mt-1 text-2xl font-black">{row.storeName || "بلا اسم"}</h1>
            <p className="mt-1 text-xs text-[#8d97c4]">
              أُرسل {row.submittedAt ? at(row.submittedAt) : "—"} · المصدر {SOURCE_LABEL[row.source] ?? row.source}
              {row.utm?.utm_source ? ` / ${row.utm.utm_source}` : ""}
              {row.utm?.utm_campaign ? ` / ${row.utm.utm_campaign}` : ""}
              {row.utm?.fbclid ? " · من إعلان فيسبوك" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CopyBrief markdown={brief} />
            <SpamToggle id={row.id} spam={row.status === "spam"} canWrite={canWrite} />
            <DeleteRequest id={row.id} code={row.code} canWrite={canWrite} />
          </div>
        </div>
        {row.etaFrom && row.etaTo ? (
          <p className={late ? "flex items-center gap-1.5 text-sm font-bold text-rose-300" : "text-sm text-[#c3cdf0]"}>
            {late ? <AlertTriangle className="size-4" aria-hidden="true" /> : null}
            وُعد العميل بالتسليم بين {at(row.etaFrom)} و{at(row.etaTo)}
            {late ? " (تجاوزنا الموعد: تواصل معه)" : ""}
          </p>
        ) : null}
        {row.status === "spam" ? <p className="text-sm font-bold text-rose-300">معلَّم كسبام: خارج الطابور ولا يُحسب في موعد التسليم.</p> : null}
      </header>

      <section className={`${card} space-y-3`}>
        <h2 className="text-sm font-black">المرحلة التي يراها العميل: {row.stage ? STAGE_INFO[row.stage].label : "—"}</h2>
        {row.stageNote ? <p className="rounded-xl bg-white/[0.04] p-3 text-sm text-[#c3cdf0]">ملاحظة ظاهرة له الآن: {row.stageNote}</p> : null}
        {row.status === "submitted" ? <StageMover id={row.id} stage={row.stage} canWrite={canWrite} hasEmail={Boolean(row.email)} /> : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={card}>
          <h2 className="mb-2 text-sm font-black">التواصل</h2>
          <dl>
            <Row label="واتساب">
              {row.whatsapp ? (
                <a href={waLink(row.whatsapp, greet) ?? "#"} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-[#25D366]" dir="ltr">
                  <MessageCircle className="size-4" aria-hidden="true" /> {row.whatsapp}
                </a>
              ) : d.contact.whatsapp ? (
                <Muted>{d.contact.whatsapp} (صيغة غير قياسية)</Muted>
              ) : (
                <Muted>—</Muted>
              )}
            </Row>
            <Row label="البريد (مالك اللوحة)">
              {row.email ? (
                <span className="inline-flex flex-wrap items-center gap-2" dir="ltr">
                  <Mail className="size-4 text-[#8d97c4]" aria-hidden="true" /> {row.email}
                  <span className={row.emailConfirmedAt ? "rounded-full bg-emerald-400/15 px-2 text-[11px] text-emerald-300" : "rounded-full bg-amber-400/15 px-2 text-[11px] text-amber-300"}>{row.emailConfirmedAt ? "مؤكد" : "غير مؤكد"}</span>
                  {!isGoogleMail(row.email) ? <span className="rounded-full bg-white/10 px-2 text-[11px] text-[#c3cdf0]">ليس Gmail: اسأله عن حساب Google للدخول</span> : null}
                </span>
              ) : (
                <Muted>—</Muted>
              )}
            </Row>
            <Row label="الصفحة">
              {social ? <ExtLink href={social}>{social.replace(/^https:\/\//, "")}</ExtLink> : <Muted>—</Muted>}
              {d.social.teamCollects ? <span className="mt-1.5 block w-fit rounded-full bg-[#6f86ff]/20 px-2 py-0.5 text-[11.5px] text-[#8fa8ff]">الفريق يجمع المنتجات منها</span> : null}
            </Row>
          </dl>
        </section>

        <section className={card}>
          <h2 className="mb-2 text-sm font-black">المتجر والهوية</h2>
          <dl>
            <Row label="النشاط">{d.store.oneLine ?? <Muted>—</Muted>}</Row>
            <Row label="الألوان">
              {d.colors.mode === "team" ? (
                <Team />
              ) : d.colors.mode === "preset" && palette ? (
                <span className="inline-flex items-center gap-2">
                  <span className="flex h-5 w-16 overflow-hidden rounded">
                    {palette.colors.map((c) => (
                      <span key={c} className="flex-1" style={{ background: c }} />
                    ))}
                  </span>
                  {palette.name}
                </span>
              ) : d.colors.mode === "logo" ? (
                "من ألوان الشعار"
              ) : d.colors.mode === "custom" && d.colors.custom ? (
                <span className="inline-flex items-center gap-2" dir="ltr">
                  <span className="size-5 rounded" style={{ background: d.colors.custom }} /> {d.colors.custom}
                </span>
              ) : (
                <Muted>لم يختر</Muted>
              )}
            </Row>
            <Row label="الشعار">
              {logo ? (
                <a href={logo} target="_blank" rel="noopener noreferrer" className="relative block size-20 overflow-hidden rounded-xl border border-white/10 bg-white">
                  <Image src={logo} alt="الشعار" fill sizes="80px" className="object-contain p-1" unoptimized />
                </a>
              ) : d.logo.team ? (
                <Team />
              ) : (
                <Muted>—</Muted>
              )}
            </Row>
            <Row label="موقع إلهام">{inspiration ? <ExtLink href={inspiration}>{inspiration.replace(/^https:\/\//, "")}</ExtLink> : d.inspiration.team ? <Team /> : <Muted>—</Muted>}</Row>
            <Row label="الدفع">{d.payment.unsure ? <Muted>مش متأكد</Muted> : d.payment.methods.map((m) => PAYMENT_OPTIONS.find((o) => o.id === m)?.label ?? m).join("، ") || <Muted>—</Muted>}</Row>
            <Row label="التوصيل">
              {DELIVERY_OPTIONS.find((o) => o.id === d.delivery.scope)?.label ?? <Muted>—</Muted>}
              {d.delivery.note ? <span className="block font-medium text-[#c3cdf0]">{d.delivery.note}</span> : null}
            </Row>
          </dl>
        </section>
      </div>

      <section className={card}>
        <h2 className="mb-3 text-sm font-black">
          المنتجات{" "}
          {d.products.mode === "team" ? <Team /> : d.products.mode === "later" ? <Muted>(يضيفها بنفسه بعد التسليم)</Muted> : <Muted>({d.products.items.length})</Muted>}
        </h2>
        {d.products.items.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.products.items.map((p, i) => {
              const img = url(p.key);
              return (
                <li key={p.id} className="flex gap-3 rounded-2xl border border-white/10 bg-[#0e1424] p-2.5">
                  {img ? (
                    <a href={img} target="_blank" rel="noopener noreferrer" className="relative size-20 shrink-0 overflow-hidden rounded-xl">
                      <Image src={img} alt={p.line || `منتج ${i + 1}`} fill sizes="80px" className="object-cover" unoptimized />
                    </a>
                  ) : (
                    <span className="grid size-20 shrink-0 place-items-center rounded-xl bg-white/5 text-[11px] text-[#8d97c4]">بلا صورة</span>
                  )}
                  <p className="min-w-0 text-sm font-bold leading-6">{p.line || <Muted>(بلا وصف)</Muted>}</p>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {voice || d.notes ? (
        <section className={`${card} space-y-3`}>
          <h2 className="text-sm font-black">كلام العميل</h2>
          {voice && isTrustedUploadUrl(voice.url) ? (
            <div className="space-y-2">
              <audio src={voice.url} controls preload="none" className="w-full" />
              {d.voice.transcript ? <p className="rounded-xl bg-white/[0.04] p-3 text-sm leading-7">{d.voice.transcript}</p> : null}
              {voice.transcript && voice.transcript !== d.voice.transcript ? <p className="text-xs leading-6 text-[#8d97c4]">التفريغ الآلي الأصلي: {voice.transcript}</p> : null}
              {voice.transcriptStatus === "failed" && !d.voice.transcript ? <p className="text-xs text-amber-300">التفريغ الآلي فشل؛ اسمع التسجيل.</p> : null}
            </div>
          ) : null}
          {d.notes ? <p className="whitespace-pre-line rounded-xl bg-white/[0.04] p-3 text-sm leading-7">{d.notes}</p> : null}
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={`${card} space-y-3`}>
          <h2 className="text-sm font-black">ملاحظة</h2>
          <NoteForm id={row.id} canWrite={canWrite} />
        </section>
        <section className={card}>
          <h2 className="mb-3 text-sm font-black">السجل</h2>
          <ol className="space-y-3">
            {[...events].reverse().map((e) => (
              <li key={e.id} className="border-s-2 border-white/10 ps-3 text-sm">
                <p className="text-xs text-[#8d97c4]">
                  {at(e.createdAt)} · {actor(e.actor)}
                </p>
                <p className="font-bold">
                  {e.type === "submitted"
                    ? "أُرسل الطلب"
                    : e.type === "stage"
                      ? `نُقل إلى «${e.toStage ? STAGE_INFO[e.toStage].label : ""}»${e.clientNotifiedAt ? " وأُبلغ العميل بالبريد" : ""}`
                      : e.type === "spam"
                        ? "عُلِّم كسبام"
                        : e.type === "restored"
                          ? "أُعيد للطابور"
                          : e.type === "email"
                            ? "بريد"
                            : "ملاحظة"}
                </p>
                {e.clientNote ? <p className="text-[#c3cdf0]">للعميل: {e.clientNote}</p> : null}
                {e.internalNote ? <p className="text-[#8d97c4]">{e.internalNote}</p> : null}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
