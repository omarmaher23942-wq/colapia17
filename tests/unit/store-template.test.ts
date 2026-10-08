import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { blueprintSchema } from "@/blueprint/schema";
import { defaultBlueprint } from "@/blueprint/defaults";
import { buildStoreProject, FORBIDDEN_IN_TEMPLATE, STORE_IDENTITY_FILES, storeFontsFile, storePackageJson } from "@/server/ownership/template";

const bp = blueprintSchema.parse(defaultBlueprint({ name: "متجر الاختبار", storeId: "s1" } as never));

describe("merchant store project", () => {
  it("contains the store and dashboard only, resolves every import, and injects the store", async () => {
    const { files, missing } = await buildStoreProject(process.cwd(), {
      storeName: "متجر الاختبار",
      subdomain: "test-shop",
      blueprint: bp,
      platformOrigin: "https://colapia.com",
    });
    expect(missing).toEqual([]);
    const paths = files.map((f) => f.path);
    // لا أي ملف من المنصة.
    expect(paths.filter((p) => FORBIDDEN_IN_TEMPLATE.some((re) => re.test(p)))).toEqual([]);
    expect(paths.some((p) => p.startsWith("src/app/s/[store]/admin"))).toBe(false);
    expect(paths.some((p) => p.includes("dashboard/billing") || p.includes("dashboard/onboarding"))).toBe(false);
    // المتجر واللوحة والإعداد والدخول موجودة.
    for (const p of [
      "src/app/s/[store]/page.tsx",
      "src/app/s/[store]/checkout/page.tsx",
      "src/app/(platform)/dashboard/page.tsx",
      "src/app/(platform)/dashboard/orders/page.tsx",
      "src/app/(platform)/dashboard/integrations/page.tsx",
      "src/app/setup/page.tsx",
      "src/app/(platform)/login/page.tsx",
      "drizzle/0000_store.sql",
      "package.json",
      "README-AR.md",
      ".gitignore",
    ])
      expect(paths, p).toContain(p);
    const text = (p: string) => String(files.find((f) => f.path === p)?.data ?? "");
    expect(text("src/store.config.ts")).toContain('"test-shop"');
    expect(text("src/lib/edition.ts")).toContain('"store"');
    expect(text("store/blueprint.json")).toContain("متجر الاختبار");
    // ملفات الهوية التي يحفظها تحديث الكود لاحقاً موجودة كلها (وإلا رفض التحديث ليحمي تصميم المتجر).
    for (const p of STORE_IDENTITY_FILES) expect(paths, p).toContain(p);
    // لا أسرار أبداً في المشروع المولّد.
    expect(paths.some((p) => /(^|\/)\.env(?!\.example)/.test(p))).toBe(false);
  }, 30_000);

  it("loads only the store's own fonts", () => {
    const f = storeFontsFile({ ...bp, theme: { ...bp.theme, fonts: { ...bp.theme.fonts, heading: "changa", body: "tajawal" } } });
    expect(f).toContain("Changa(");
    expect(f).toContain("Tajawal(");
    expect(f).not.toContain("El_Messiri(");
  });

  it("pins dependencies and adds typings for used packages", () => {
    const pkg = JSON.parse(
      storePackageJson(
        "x",
        new Set(["qrcode", "zod"]),
        { dependencies: { qrcode: "^1.5.4", zod: "^3.25.0", next: "^15.5.0" }, devDependencies: { "@types/qrcode": "^1.5.5", typescript: "^5.8.0" } },
        (n) => ({ qrcode: "1.5.4", zod: "3.25.76" })[n] ?? null
      )
    );
    // الإصدار المثبّت فعلاً هو المرجع، وما لا إصدار مثبّتاً له يبقى نطاقاً لا يُقطع إلى أقدم إصدار.
    expect(pkg.dependencies.qrcode).toBe("1.5.4");
    expect(pkg.dependencies.zod).toBe("3.25.76");
    expect(pkg.devDependencies["@types/qrcode"]).toBe("^1.5.5");
    expect(pkg.dependencies.next).toBe("^15.5.0");
  });

  it("pins the exact platform versions so the merchant's npm install resolves peers (zod ≥ 3.25.76 for @ai-sdk/groq)", async () => {
    const { files } = await buildStoreProject(process.cwd(), { storeName: "س", subdomain: "pins", blueprint: bp, platformOrigin: "https://colapia.com" });
    const pkg = JSON.parse(String(files.find((f) => f.path === "package.json")!.data));
    const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
    for (const name of ["zod", "@ai-sdk/groq", "ai", "next", "react"]) {
      if (pkg.dependencies[name]) expect(pkg.dependencies[name]).toBe(lock.packages[`node_modules/${name}`].version);
    }
  });

  it("every required peer of every dependency is present and satisfied, so npm install never fails with ERESOLVE", async () => {
    const semver = createRequire(import.meta.url)("semver") as { satisfies: (v: string, range: string, o?: { includePrerelease?: boolean }) => boolean };
    const { files } = await buildStoreProject(process.cwd(), { storeName: "س", subdomain: "peers", blueprint: bp, platformOrigin: "https://colapia.com" });
    const pkg = JSON.parse(String(files.find((f) => f.path === "package.json")!.data));
    const all: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
    const lock = JSON.parse(readFileSync("package-lock.json", "utf8")).packages as Record<string, { peerDependencies?: Record<string, string>; peerDependenciesMeta?: Record<string, { optional?: boolean }> }>;
    const problems: string[] = [];
    for (const name of Object.keys(all)) {
      const meta = lock[`node_modules/${name}`];
      for (const [peer, range] of Object.entries(meta?.peerDependencies ?? {})) {
        if (meta?.peerDependenciesMeta?.[peer]?.optional && !all[peer]) continue;
        if (!all[peer]) problems.push(`${name} needs ${peer}`);
        else if (!semver.satisfies(all[peer]!, range, { includePrerelease: true })) problems.push(`${name} needs ${peer} ${range}, got ${all[peer]}`);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe("transfer data transforms", () => {
  it("rewrites media urls everywhere in a row and revives dates", async () => {
    const { rewriteMedia, reviveRows } = await import("@/db/transfer-tables");
    const { products } = await import("@/db/schema");
    const old = "https://abc.ufs.sh/f/KEY1";
    const rows = rewriteMedia(
      [{ id: "p1", images: [{ url: old, key: "KEY1" }], description: `صورة ${old}`, createdAt: "2026-10-01T10:00:00.000Z" }],
      { [old]: "https://new.ufs.sh/f/NEW1", "https://abc.ufs.sh/f/missing": "https://abc.ufs.sh/f/missing" }
    );
    expect(JSON.stringify(rows)).not.toContain(old);
    expect(rows[0]!.images[0]!.url).toBe("https://new.ufs.sh/f/NEW1");
    const [r] = reviveRows(products, rows);
    expect(r!.createdAt).toBeInstanceOf(Date);
    expect(r!.id).toBe("p1");
  });
});
