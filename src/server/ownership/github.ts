// github.ts — إنشاء مستودع خاص في حساب GitHub الخاص بالتاجر ورفع كود متجره إليه.
//
// التاجر يوافق من صفحة GitHub نفسها (OAuth)، ثم نستخدم الصلاحية لحظياً لإنشاء المستودع والرفع،
// ولا نحفظ أي توكن. الحالة (state) موقّعة ومربوطة بالمتصفح بكوكي، فلا يمكن تمرير موافقة شخص آخر.
import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env, clientEnv } from "@/lib/env";
import type { TemplateFile } from "./template";

const GH = "https://api.github.com";
export const GITHUB_STATE_COOKIE = "clp_gh_state";
const STATE_TTL_MS = 15 * 60_000;

export const githubEnabled = () => Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
export const githubCallbackUrl = () => `${clientEnv.NEXT_PUBLIC_APP_URL}/api/ownership/github/callback`;

/** u = 1: تحديث مستودع التاجر الموجود بدل إنشاء مستودع جديد. */
type State = { s: string; m: string; n: string; e: number; u?: 1 };

const sign = (payload: string) => createHmac("sha256", env.AUTH_SECRET).update(`gh:${payload}`).digest("base64url");

export function newGithubState(storeId: string, merchantId: string, update = false): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ s: storeId, m: merchantId, n: nonce, e: Date.now() + STATE_TTL_MS, ...(update ? { u: 1 as const } : {}) } satisfies State)
  ).toString("base64url");
  return { state: `${payload}.${sign(payload)}`, nonce };
}

export function readGithubState(state: string | null, cookieNonce: string | undefined): State | null {
  if (!state || !cookieNonce) return null;
  const [payload, mac] = state.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const got = Buffer.from(mac);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as State;
    if (s.e < Date.now() || s.n !== cookieNonce) return null;
    return s;
  } catch {
    return null;
  }
}

export function githubAuthorizeUrl(state: string): string {
  const u = new URL("https://github.com/login/oauth/authorize");
  u.searchParams.set("client_id", env.GITHUB_CLIENT_ID!);
  u.searchParams.set("redirect_uri", githubCallbackUrl());
  // repo: لإنشاء مستودع خاص والرفع إليه. لا نطلب أي صلاحية أخرى.
  u.searchParams.set("scope", "repo");
  u.searchParams.set("state", state);
  u.searchParams.set("allow_signup", "true");
  return u.toString();
}

export class GithubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GithubError";
  }
}

export async function exchangeGithubCode(code: string): Promise<string> {
  const r = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: githubCallbackUrl() }),
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; scope?: string; error_description?: string };
  if (!j.access_token) throw new GithubError(j.error_description || "تعذّر إكمال الموافقة من GitHub");
  if (!(j.scope ?? "").split(",").includes("repo")) throw new GithubError("لم تُمنح صلاحية إنشاء المستودع. أعد المحاولة ووافق على الصلاحية المطلوبة.");
  return j.access_token;
}

async function gh<T>(token: string, path: string, init: RequestInit & { json?: unknown } = {}): Promise<{ status: number; body: T }> {
  const r = await fetch(`${GH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    signal: AbortSignal.timeout(25_000),
  });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as T };
}

const isText = (d: string | Uint8Array) => typeof d === "string";

/** ينشئ مستودعاً خاصاً باسم متاح، ويرفع كل الملفات في commit واحد. يعيد owner/name ورابطه. */
export async function createStoreRepo(
  token: string,
  baseName: string,
  storeName: string,
  files: TemplateFile[]
): Promise<{ fullName: string; htmlUrl: string }> {
  const user = await gh<{ login?: string }>(token, "/user");
  if (!user.body.login) throw new GithubError("تعذّر قراءة حساب GitHub");

  let repo: { full_name?: string; html_url?: string; default_branch?: string } | null = null;
  for (let i = 0; i < 6 && !repo; i++) {
    const name = i === 0 ? baseName : `${baseName}-${i + 1}`;
    const r = await gh<{ full_name?: string; html_url?: string; default_branch?: string }>(token, "/user/repos", {
      method: "POST",
      json: { name, private: true, auto_init: true, description: `متجر ${storeName} — المتجر ولوحة التحكم (من Colapia)` },
    });
    if (r.status === 201) repo = r.body;
    else if (r.status !== 422) throw new GithubError("تعذّر إنشاء المستودع على GitHub");
  }
  if (!repo?.full_name) throw new GithubError("كل الأسماء المقترحة للمستودع مستخدمة في حسابك");
  const full = repo.full_name;
  const branch = repo.default_branch || "main";

  // auto_init ينشئ أول commit خلال لحظات.
  let head: string | undefined;
  for (let i = 0; i < 8 && !head; i++) {
    const ref = await gh<{ object?: { sha?: string } }>(token, `/repos/${full}/git/ref/heads/${branch}`);
    head = ref.body.object?.sha;
    if (!head) await new Promise((r) => setTimeout(r, 750));
  }
  if (!head) throw new GithubError("المستودع لم يجهز بعد، أعد المحاولة بعد دقيقة");

  // الملفات النصية تُرسل مع الشجرة مباشرة، والثنائية (صور وأصوات) كـ blobs.
  const tree: { path: string; mode: "100644"; type: "blob"; content?: string; sha?: string }[] = [];
  for (const f of files) {
    if (isText(f.data)) {
      tree.push({ path: f.path, mode: "100644", type: "blob", content: f.data as string });
      continue;
    }
    const b = await gh<{ sha?: string }>(token, `/repos/${full}/git/blobs`, {
      method: "POST",
      json: { content: Buffer.from(f.data as Uint8Array).toString("base64"), encoding: "base64" },
    });
    if (!b.body.sha) throw new GithubError("تعذّر رفع أحد الملفات");
    tree.push({ path: f.path, mode: "100644", type: "blob", sha: b.body.sha });
  }
  const t = await gh<{ sha?: string }>(token, `/repos/${full}/git/trees`, { method: "POST", json: { tree } });
  if (!t.body.sha) throw new GithubError("تعذّر تجهيز ملفات المتجر على GitHub");
  const c = await gh<{ sha?: string }>(token, `/repos/${full}/git/commits`, {
    method: "POST",
    json: { message: `متجر ${storeName}: المتجر ولوحة التحكم`, tree: t.body.sha, parents: [head] },
  });
  if (!c.body.sha) throw new GithubError("تعذّر حفظ الملفات على GitHub");
  const u = await gh(token, `/repos/${full}/git/refs/heads/${branch}`, { method: "PATCH", json: { sha: c.body.sha, force: true } });
  if (u.status !== 200) throw new GithubError("تعذّر تحديث المستودع");

  return { fullName: full, htmlUrl: repo.html_url ?? `https://github.com/${full}` };
}

/**
 * يحدّث مستودع التاجر الموجود بآخر نسخة من كود متجره في commit واحد (Vercel يعيد النشر تلقائياً).
 * الشجرة الجديدة = الملفات الجديدة + ملفات keepPaths كما هي في المستودع (هوية المتجر)، فتُحذف أي ملفات قديمة
 * لم تعد في المشروع، ولا يُلمس تصميم المتجر ولا إعداداته.
 */
export async function updateStoreRepo(
  token: string,
  fullName: string,
  storeName: string,
  files: TemplateFile[],
  keepPaths: readonly string[] = []
): Promise<{ fullName: string; htmlUrl: string; commit: string }> {
  const repo = await gh<{ full_name?: string; html_url?: string; default_branch?: string; permissions?: { push?: boolean } }>(token, `/repos/${fullName}`);
  if (repo.status === 404 || !repo.body.full_name) throw new GithubError(`لم نجد مستودع متجرك (${fullName}) في حساب GitHub الذي وافقت منه. ادخل بنفس الحساب.`);
  if (repo.body.permissions && repo.body.permissions.push === false) throw new GithubError("حساب GitHub هذا لا يملك صلاحية الرفع على مستودع متجرك.");
  const full = repo.body.full_name;
  const branch = repo.body.default_branch || "main";

  const ref = await gh<{ object?: { sha?: string } }>(token, `/repos/${full}/git/ref/heads/${branch}`);
  const head = ref.body.object?.sha;
  if (!head) throw new GithubError("تعذّر قراءة آخر نسخة في مستودعك");
  const commit = await gh<{ tree?: { sha?: string } }>(token, `/repos/${full}/git/commits/${head}`);
  const baseTree = commit.body.tree?.sha;
  if (!baseTree) throw new GithubError("تعذّر قراءة ملفات مستودعك");
  const current = await gh<{ tree?: { path: string; mode: string; type: string; sha: string }[] }>(token, `/repos/${full}/git/trees/${baseTree}?recursive=1`);
  const keep = new Set(keepPaths);
  const kept = (current.body.tree ?? []).filter((e) => e.type === "blob" && keep.has(e.path));
  if (keepPaths.length && kept.length < keepPaths.length)
    throw new GithubError("ملفات هوية متجرك غير موجودة في المستودع، فلا يمكن تحديثه دون فقدان تصميمه. تواصل معنا.");

  const tree: { path: string; mode: string; type: "blob"; content?: string; sha?: string }[] = kept.map((e) => ({ path: e.path, mode: e.mode, type: "blob", sha: e.sha }));
  for (const f of files) {
    if (keep.has(f.path)) continue;
    if (isText(f.data)) {
      tree.push({ path: f.path, mode: "100644", type: "blob", content: f.data as string });
      continue;
    }
    const b = await gh<{ sha?: string }>(token, `/repos/${full}/git/blobs`, {
      method: "POST",
      json: { content: Buffer.from(f.data as Uint8Array).toString("base64"), encoding: "base64" },
    });
    if (!b.body.sha) throw new GithubError("تعذّر رفع أحد الملفات");
    tree.push({ path: f.path, mode: "100644", type: "blob", sha: b.body.sha });
  }
  const t = await gh<{ sha?: string }>(token, `/repos/${full}/git/trees`, { method: "POST", json: { tree } });
  if (!t.body.sha) throw new GithubError("تعذّر تجهيز التحديث على GitHub");
  const c = await gh<{ sha?: string }>(token, `/repos/${full}/git/commits`, {
    method: "POST",
    json: { message: `تحديث ${storeName} لآخر إصدار من Colapia`, tree: t.body.sha, parents: [head] },
  });
  if (!c.body.sha) throw new GithubError("تعذّر حفظ التحديث على GitHub");
  const u = await gh(token, `/repos/${full}/git/refs/heads/${branch}`, { method: "PATCH", json: { sha: c.body.sha } });
  if (u.status !== 200) throw new GithubError("تعذّر تحديث المستودع (تغيّر أثناء التحديث؟ أعد المحاولة).");
  return { fullName: full, htmlUrl: repo.body.html_url ?? `https://github.com/${full}`, commit: c.body.sha };
}
