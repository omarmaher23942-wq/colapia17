// /admin/requests/[id] — كل ما أرسله العميل كما هو (والمتروك للفريق معلَّم صراحة)، وصوره، ونقل
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
import { DELIVERY_OPTIONS, FEE_OPTIONS, PAYMENT_OPTIONS, RETURN_OPTIONS, safeUrl, socialUrl } from "@/intake/schema";
import { paletteById } from "@/intake/palettes";
import { renderBrief } from "@/intake/brief";
import { requirePlatformPage } from "@/server/platform-guard";
import { waLink } from "@/lib/whatsapp";
import { isTrustedUploadUrl } from "@/lib/upload-hosts";
import { CopyBrief, DeleteRequest, NoteForm, SpamToggle, StageMover } from "@/components/platform/requests/RequestActions";
import { ProductionPanel, type Member } from "@/components/platform/requests/ProductionPanel";
import { RequestDataEditor } from "@/components/platform/requests/RequestDataEditor";
import { can, isPlatformRole } from "@/agency/roles";
import { canViewRequest, overdueHours, readQa, PRODUCTION_INFO, type ProductionState } from "@/agency/production";
import { branchFor, renderPrompt } from "@/agency/prompt";
import { suggestSlug } from "@/agency/slug";
import { productionSla } from "@/agency/settings";
import { stores } from "@/db/schema";
import { storeUrl } from "@/lib/utils";
import { githubConfigured } from "@/agency/github";
import { hasFolderData } from "@/stores/resolve";
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
  const role = isPlatformRole(me.role) ? me.role : "sales";
  const viewer = { id: me.id, role };

  let row: typeof storeRequests.$inferSelect | undefined;
  try {
    [row] = await db.select().from(storeRequests).where(eq(storeRequests.id, id)).limit(1);
  } catch (e) {
    if (isMissingTable(e)) notFound();
    throw e;
  }
  if (!row || row.status === "draft") notFound();
  // المنفّذ يرى ما أُسند إليه فقط (الخادم يفرضه هنا وفي كل إجراء).
  if (!canViewRequest(row, viewer)) notFound();
  const mine = row.builderId === me.id;
  const canManage = can(role, "requests.assign");
  const canClient = can(role, "requests.client_stage") && (role !== "builder" || mine);

  const [assets, events, team, sla] = await Promise.all([
    requestAssets(row.id),
    requestEvents(row.id),
    db.select({ id: platformUsers.id, name: platformUsers.name, role: platformUsers.role, isActive: platformUsers.isActive }).from(platformUsers),
    productionSla(),
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
  const logo = url(d.logo.key);
  const late = isLate(row);
  const brief = renderBrief({ code: row.code, data: d, assets: assets.filter((a) => a.kind === "image" || a.kind === "logo").map((a) => ({ key: a.key, url: a.url, kind: a.kind as "image" | "logo" })), submittedAt: row.submittedAt });
  const greet = `أهلاً، معاك فريق Colapia بخصوص طلب متجر «${row.storeName ?? ""}» (${row.code}).`;

  // النطاق: المحفوظ، وإلا اقتراح لا يصطدم بمتجر قائم (التثبيت عند حفظه أو التجهيز).
  const takenSubs = new Set((await db.select({ s: stores.subdomain }).from(stores)).map((x) => x.s));
  const slug = row.slug ?? suggestSlug({ storeName: d.store.name, socialUrl: social, code: row.code }, (s) => takenSubs.has(s));
  const branch = branchFor(slug, row.round);
  const lastReturn = [...events].reverse().find((e) => e.type === "production" && e.internalNote?.includes("← قيد البناء:"));
  const prompt = renderPrompt({
    slug,
    code: row.code,
    storeName: row.storeName,
    brief,
    provisioned: Boolean(row.storeId),
    branch,
    teamNotes: events.filter((e) => e.type === "note" && e.internalNote && !e.internalNote.startsWith("بانتظار العميل") && e.internalNote !== "انتهى انتظار العميل").map((e) => e.internalNote!),
    reviewerNote: row.round > 1 && lastReturn?.internalNote ? lastReturn.internalNote.split("← قيد البناء:")[1]?.trim() ?? null : null,
  });
  const members: Member[] = team.filter((t) => t.isActive && isPlatformRole(t.role)).map((t) => ({ id: t.id, name: t.name, role: t.role as Member["role"] }));
  const imageUrls = Object.fromEntries(assets.filter((a) => isTrustedUploadUrl(a.url)).map((a) => [a.key, a.url]));

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
            <SpamToggle id={row.id} spam={row.status === "spam"} canWrite={can(role, "requests.spam")} />
            <DeleteRequest id={row.id} code={row.code} canWrite={can(role, "requests.delete")} />
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

      {row.status === "submitted" ? (
        <section className={`${card} space-y-3`}>
          <h2 className="text-sm font-black">الإنتاج (داخلي): {PRODUCTION_INFO[row.production as ProductionState].label}</h2>
          {row.waitingReason ? <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm font-bold text-amber-200">بانتظار العميل: {row.waitingReason}</p> : null}
          <ProductionPanel
            id={row.id}
            me={viewer}
            production={row.production as ProductionState}
            builderId={row.builderId}
            reviewerId={row.reviewerId}
            qa={readQa(row.qa)}
            slug={slug}
            slugLocked={Boolean(row.storeId)}
            waitingReason={row.waitingReason}
            members={members}
            prompt={prompt}
            branch={branch}
            round={row.round}
            hasEmail={Boolean(row.email)}
            overdue={row.waitingReason ? 0 : overdueHours(row.production as ProductionState, row.productionChangedAt, sla)}
            storeId={row.storeId}
            storeUrl={storeUrl(slug)}
            previewUrl={process.env.STORE_PREVIEW_KEY ? storeUrl(slug, `/?preview=${encodeURIComponent(process.env.STORE_PREVIEW_KEY)}`) : null}
            github={githubConfigured()}
            folderBuilt={hasFolderData(slug)}
          />
        </section>
      ) : null}

      <section className={`${card} space-y-3`}>
        <h2 className="text-sm font-black">المرحلة التي يراها العميل: {row.stage ? STAGE_INFO[row.stage].label : "—"}</h2>
        {row.stageNote ? <p className="rounded-xl bg-white/[0.04] p-3 text-sm text-[#c3cdf0]">ملاحظة ظاهرة له الآن: {row.stageNote}</p> : null}
        <p className="text-[12px] text-[#8d97c4]">تتقدم تلقائياً مع حالة الإنتاج. انقلها يدوياً فقط لتفصيل أدق (مثل «التصميم» ثم «البناء») أو لتكتب له ملاحظة.</p>
        {row.status === "submitted" ? <StageMover id={row.id} stage={row.stage} canWrite={canClient} hasEmail={Boolean(row.email)} /> : null}
      </section>

      {row.status === "submitted" && (canManage || (mine && can(role, "requests.work"))) && row.production !== "delivered" ? (
        <RequestDataEditor id={row.id} data={d} version={row.updatedAt.toISOString()} imageUrls={imageUrls} />
      ) : null}
      {row.clientData ? <p className="text-[12px] text-[#8d97c4]">عدّل الفريق بيانات هذا الطلب؛ نسخة العميل الأصلية محفوظة.</p> : null}

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
            <Row label="الدفع">
              {d.payment.methods.length ? (
                <ul className="space-y-1">
                  {d.payment.methods.map((m) => (
                    <li key={m}>
                      {PAYMENT_OPTIONS.find((o) => o.id === m)?.label ?? m}
                      {m === "wallet" ? <span className="block font-medium text-[#c3cdf0]" dir="ltr">{d.payment.walletNumber || "—"}</span> : null}
                      {m === "instapay" ? <span className="block font-medium text-[#c3cdf0]" dir="ltr">{d.payment.instapayAddress || "—"}</span> : null}
                      {m === "cod" ? <span className="block font-medium text-[#c3cdf0]">المعاينة وفتح الشحنة: {d.payment.inspection === "yes" ? "متاحان" : d.payment.inspection === "no" ? "غير متاحين" : "لم يحدد"}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <Muted>—</Muted>
              )}
            </Row>
            <Row label="التوصيل">
              {DELIVERY_OPTIONS.find((o) => o.id === d.delivery.scope)?.label ?? <Muted>—</Muted>}
              {d.delivery.note ? <span className="block font-medium text-[#c3cdf0]">{d.delivery.note}</span> : null}
              {d.delivery.fee ? (
                <span className="block font-medium text-[#c3cdf0]">
                  {d.delivery.fee === "flat" ? `الشحن ${d.delivery.feeAmount ?? "؟"} جنيه` : (FEE_OPTIONS.find((o) => o.id === d.delivery.fee)?.label ?? "")}
                  {d.delivery.feeNote ? ` — ${d.delivery.feeNote}` : ""}
                </span>
              ) : null}
              {d.delivery.eta ? <span className="block font-medium text-[#c3cdf0]">المدة: {d.delivery.eta}</span> : null}
            </Row>
            <Row label="الاستبدال">
              {d.returns.mode ? `${RETURN_OPTIONS.find((o) => o.id === d.returns.mode)?.label ?? ""}${d.returns.days && d.returns.mode !== "none" ? ` خلال ${d.returns.days} يوماً` : ""}` : <Muted>لم يحدد</Muted>}
            </Row>
          </dl>
        </section>
      </div>

      <section className={card}>
        <h2 className="mb-3 text-sm font-black">
          المنتجات <Muted>({d.products.items.length})</Muted>
        </h2>
        {d.products.items.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {d.products.items.map((p, i) => {
              const imgs = p.images.map((k) => url(k)).filter((u): u is string => Boolean(u));
              return (
                <li key={p.id} className="space-y-2 rounded-2xl border border-white/10 bg-[#0e1424] p-3">
                  <p className="whitespace-pre-line text-sm font-bold leading-6">{p.text || <Muted>(بلا وصف)</Muted>}</p>
                  {imgs.length ? (
                    <div className="flex flex-wrap gap-2">
                      {imgs.map((img, n) => (
                        <a key={img} href={img} target="_blank" rel="noopener noreferrer" className="relative size-16 shrink-0 overflow-hidden rounded-lg">
                          <Image src={img} alt={`منتج ${i + 1} صورة ${n + 1}`} fill sizes="64px" className="object-cover" unoptimized />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <span className="inline-block rounded-lg bg-white/5 px-2 py-1 text-[11px] text-[#8d97c4]">بلا صور</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {d.notes ? (
        <section className={`${card} space-y-3`}>
          <h2 className="text-sm font-black">كلام العميل</h2>
          <p className="whitespace-pre-line rounded-xl bg-white/[0.04] p-3 text-sm leading-7">{d.notes}</p>
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={`${card} space-y-3`}>
          <h2 className="text-sm font-black">ملاحظة</h2>
          <NoteForm id={row.id} canWrite={can(role, "requests.note")} />
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
                            : e.type === "production"
                              ? "الإنتاج"
                              : e.type === "assign"
                                ? "الإسناد"
                                : e.type === "qa"
                                  ? "قائمة الفحص"
                                  : e.type === "edited"
                                    ? "تعديل البيانات"
                                    : e.type === "slug"
                                      ? "النطاق"
                                      : e.type === "provision"
                                        ? "التجهيز"
                                        : e.type === "delivered"
                                          ? "التسليم"
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
