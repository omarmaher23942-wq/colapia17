import "server-only";
// github.ts — كتابة مجلد المتجر في فرع بناء على GitHub بـ commit واحد (Git Data API)، بتوكن دقيق الصلاحية من
// متغيرات البيئة (STORES_GITHUB_TOKEN + STORES_GITHUB_REPO). لا يُكتب في main أبداً. بدون التوكن: null والمنفّذ
// يُنزّل المجلد ZIP.
import { env } from "@/lib/env";

const API = "https://api.github.com";

export const githubConfigured = () => Boolean(env.STORES_GITHUB_TOKEN && env.STORES_GITHUB_REPO);

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}/repos/${env.STORES_GITHUB_REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.STORES_GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`github ${init?.method ?? "GET"} ${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as T;
}

/** يكتب الملفات في الفرع (ينشئه من main إن لم يوجد) ويعيد رابط الفرع. */
export async function writeBranch(branch: string, files: Record<string, string>, message: string): Promise<string> {
  if (!githubConfigured()) throw new Error("github_not_configured");
  if (!/^build\/[a-z0-9-]+$/.test(branch)) throw new Error("bad_branch");
  const existing = await gh<{ object: { sha: string } }>(`/git/ref/heads/${branch}`).catch(() => null);
  const base = existing ?? (await gh<{ object: { sha: string } }>(`/git/ref/heads/main`));
  const parent = base.object.sha;
  const commit = await gh<{ tree: { sha: string } }>(`/git/commits/${parent}`);
  const tree = await gh<{ sha: string }>(`/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: commit.tree.sha, tree: Object.entries(files).map(([path, content]) => ({ path, mode: "100644", type: "blob", content })) }),
  });
  const created = await gh<{ sha: string }>(`/git/commits`, { method: "POST", body: JSON.stringify({ message, tree: tree.sha, parents: [parent] }) });
  if (existing) await gh(`/git/refs/heads/${branch}`, { method: "PATCH", body: JSON.stringify({ sha: created.sha, force: false }) });
  else await gh(`/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: created.sha }) });
  return `https://github.com/${env.STORES_GITHUB_REPO}/tree/${branch}`;
}
