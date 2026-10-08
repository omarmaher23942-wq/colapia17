// /api/ownership/github/callback — بعد موافقة التاجر: ننشئ مستودعه الخاص ونرفع كود متجره.
// التوكن يُستخدم داخل هذا الطلب فقط ولا يُحفظ.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";
import { allow } from "@/lib/ratelimit";
import { log } from "@/lib/logger";
import { GITHUB_STATE_COOKIE, GithubError, createStoreRepo, exchangeGithubCode, readGithubState, updateStoreRepo } from "@/server/ownership/github";
import { STORE_IDENTITY_FILES } from "@/server/ownership/template";
import { projectFilesFor } from "@/server/ownership/project";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/dashboard/own?${q}`, req.url));
  const jar = await cookies();
  const state = readGithubState(url.searchParams.get("state"), jar.get(GITHUB_STATE_COOKIE)?.value);
  jar.delete({ name: GITHUB_STATE_COOKIE, path: "/api/ownership/github" });

  if (url.searchParams.get("error")) return back("github=denied");
  const s = await getMerchantStoreOrNull();
  if (!s || !state || state.s !== s.storeId || state.m !== s.merchantId) return back("github=expired");
  if (s.store.status !== "active") return back("github=not_active");
  if (!(await allow("ownership", `gh:${s.storeId}`))) return back("github=busy");
  const code = url.searchParams.get("code");
  if (!code) return back("github=denied");

  try {
    const token = await exchangeGithubCode(code);
    if (state.u && s.store.ownedRepo) {
      // متجر استُلم (بياناته حُذفت من المنصة): الكود فقط، وهوية المتجر تبقى من مستودعه.
      const purged = Boolean(s.store.purgedAt);
      const files = await projectFilesFor(s.store, { identity: purged ? "keep" : "current" });
      const r = await updateStoreRepo(token, s.store.ownedRepo, s.store.name, files, purged ? STORE_IDENTITY_FILES : []);
      log.info("store", "store_repo_updated", { storeId: s.storeId, repo: r.fullName, commit: r.commit, files: files.length });
      return back(`github=updated&repo=${encodeURIComponent(r.fullName)}`);
    }
    const files = await projectFilesFor(s.store);
    const repo = await createStoreRepo(token, `${s.store.subdomain}-store`, s.store.name, files);
    await db.update(stores).set({ ownedRepo: repo.fullName, updatedAt: new Date() }).where(eq(stores.id, s.storeId));
    log.info("store", "store_repo_created", { storeId: s.storeId, repo: repo.fullName, files: files.length });
    return back(`github=ok&repo=${encodeURIComponent(repo.fullName)}`);
  } catch (e) {
    log.error("store", "store_repo_failed", { storeId: s.storeId }, "", e);
    const msg = e instanceof GithubError ? e.message : "تعذّر إنشاء المستودع الآن، أعد المحاولة.";
    return back(`github=error&message=${encodeURIComponent(msg)}`);
  }
}
