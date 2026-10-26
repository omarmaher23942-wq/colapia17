import { describe, expect, it } from "vitest";
import { localSource } from "@/delivery/source";
import { buildDeliveryProject } from "@/delivery/build";
import { applyPatches, ONBOARDING_CAPTION } from "@/delivery/patches";
import { embedMigrations, instagramHandle, normalizeSlug } from "@/delivery/inject";
import { identityFromRequest } from "@/delivery/project";
import { SAMPLE_IDENTITY } from "@/delivery/sample";

describe("pure helpers", () => {
  it("instagramHandle / normalizeSlug", () => {
    expect(instagramHandle("https://www.instagram.com/my.shop/?hl=ar")).toBe("my.shop");
    expect(instagramHandle("@abc_1")).toBe("abc_1");
    expect(instagramHandle("غير صالح!")).toBeUndefined();
    expect(normalizeSlug("My Shop__X")).toBe("my-shop-x");
    expect(normalizeSlug("متجر")).toBe("store");
  });
  it("applyPatches fails loudly when the platform file changed", () => {
    expect(() => applyPatches("a.ts", "x", [{ path: "a.ts", find: "missing", replace: "y", why: "t" }])).toThrow(/patch/);
    expect(applyPatches("a.ts", "x z", [{ path: "a.ts", find: "z", replace: "$&", why: "t" }])).toBe("x $&");
  });
  it("embedMigrations hashes and splits statements", () => {
    const m = embedMigrations(JSON.stringify({ entries: [{ tag: "0000_a", when: 5 }] }), { "0000_a": "A;--> statement-breakpoint\nB;" });
    expect(m[0]).toMatchObject({ tag: "0000_a", folderMillis: 5, statements: ["A;", "B;"] });
    expect(m[0]!.hash).toHaveLength(64);
  });
  it("identityFromRequest needs name and email", () => {
    expect(() => identityFromRequest({ storeName: "x", data: {} })).toThrow(/بريد/);
    const id = identityFromRequest({ storeName: "متجر", email: "A@B.com", slug: "nova", data: { niche: "shoes" } });
    expect(id).toMatchObject({ ownerEmail: "a@b.com", slug: "nova", storeFolder: "nova", niche: "shoes" });
  });
});

describe("generated client project", () => {
  it("has required files, no platform leaks, one onboarding caption", async () => {
    const { files, missing } = await buildDeliveryProject(await localSource(process.cwd()), { ...SAMPLE_IDENTITY, slug: "nova", storeFolder: "nova" });
    expect(missing).toEqual([]);
    const paths = new Set(files.map((f) => f.path));
    for (const p of [
      "package.json", "tsconfig.json", "next.config.ts", "open-next.config.ts", "wrangler.jsonc", "postcss.config.mjs", "drizzle.config.ts",
      "CLAUDE.md", "README.md", "docs/SETUP.md", ".env.example", ".gitignore", ".github/workflows/deploy.yml",
      "src/store.config.ts", "src/middleware.ts", "src/db/migrations.generated.ts", "src/app/(platform)/setup/page.tsx", "src/app/(platform)/login/page.tsx",
      "src/app/media/[...key]/route.ts", "src/lib/image-loader.ts", "store/blueprint.json", "drizzle/meta/_journal.json", "stores/nova/store.json",
    ]) expect(paths.has(p), p).toBe(true);

    const bad = [...paths].filter((p) => /^src\/(agent|agency|golden|delivery|lifecycle|channels|ai\/(agents|lifecycle|build))\//.test(p) || /^src\/app\/\(platform\)\/(\(dash\)|dashboard\/(billing|usage|team|requests|domain|store)\/)/.test(p));
    expect(bad).toEqual([]);

    const pkg = JSON.parse(String(files.find((f) => f.path === "package.json")!.data)) as { dependencies: Record<string, string> };
    for (const dep of ["@upstash/redis", "uploadthing", "pusher", "@sentry/nextjs", "aws4fetch"]) expect(pkg.dependencies[dep], dep).toBeUndefined();
    expect(pkg.dependencies["@neondatabase/serverless"]).toBeTruthy();

    const text = files.filter((f) => typeof f.data === "string" && /\.(ts|tsx|json|jsonc|md)$/.test(f.path)).map((f) => ({ p: f.path, t: f.data as string }));
    expect(text.filter((f) => /\{\{(STORE_NAME|SLUG|OWNER_EMAIL|REQUEST_CODE|AGENCY_URL|GENERATED_AT)\}\}/.test(f.t)).map((f) => f.p)).toEqual([]);
    const dead = text.filter((f) => /href="\/dashboard\/(billing|usage|team|requests|domain|store)\b/.test(f.t)).map((f) => f.p);
    expect(dead).toEqual([]);
    expect(text.filter((f) => f.t.includes(ONBOARDING_CAPTION)).length).toBe(1);
    expect(text.find((f) => f.p === "wrangler.jsonc")!.t).toContain('"keep_names": false');
  }, 60_000);
});
