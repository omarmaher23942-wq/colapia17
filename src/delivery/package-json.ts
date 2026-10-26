// package-json.ts — package.json لمشروع العميل: الحزم التي تستوردها الملفات المجمّعة فقط، بإصدارات المنصة المثبّتة نفسها
// (من package-lock.json) حتى يُبنى المشروع بالإصدارات التي اختُبرت.
const json = (v: unknown) => JSON.stringify(v, null, 2);

/** حزم لا تظهر في الاستيراد لكنها لازمة للبناء والنشر. */
const BUILD_PACKAGES = ["next", "react", "react-dom", "tailwindcss", "@tailwindcss/postcss", "postcss", "drizzle-orm", "@neondatabase/serverless", "server-only"];
const DEV_PACKAGES = ["typescript", "@types/node", "@types/react", "@types/react-dom", "@opennextjs/cloudflare", "wrangler", "drizzle-kit"];
/** حزم تُستورد في الكود لكنها غير مستخدمة فعلياً بدون خدمات المنصة، أو تُستبدل في المشروع. */
const NEVER_INSTALL = new Set(["@upstash/redis", "@upstash/ratelimit", "@upstash/qstash", "@upstash/workflow", "@upstash/vector", "pusher", "uploadthing", "@uploadthing/react", "@sentry/nextjs", "aws4fetch"]);

export type PackageSource = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export type LockPackages = Record<string, { version?: string; peerDependencies?: Record<string, string>; peerDependenciesMeta?: Record<string, { optional?: boolean }> }>;

export function projectPackageJson(opts: {
  slug: string;
  packages: Set<string>;
  platform: PackageSource;
  lock: LockPackages;
  installed: (name: string) => string | null;
}): string {
  const all = { ...opts.platform.devDependencies, ...opts.platform.dependencies };
  // الإصدار المثبّت فعلاً على المنصة يُثبَّت كما هو (حتمي)؛ بلا مثبّت نبقي نطاق المنصة.
  const version = (name: string) => opts.lock[`node_modules/${name}`]?.version ?? opts.installed(name) ?? all[name] ?? null;
  const deps: Record<string, string> = {};
  for (const name of [...opts.packages, ...BUILD_PACKAGES].sort()) {
    if (DEV_PACKAGES.includes(name) || NEVER_INSTALL.has(name)) continue;
    const v = version(name);
    if (v) deps[name] = v;
  }
  // اعتماديات ندية إلزامية (مثل peer لحزمة مثبتة) بإصدار المنصة نفسه.
  for (const name of Object.keys(deps)) {
    const meta = opts.lock[`node_modules/${name}`];
    for (const peer of Object.keys(meta?.peerDependencies ?? {})) {
      if (meta?.peerDependenciesMeta?.[peer]?.optional || deps[peer] || DEV_PACKAGES.includes(peer) || NEVER_INSTALL.has(peer)) continue;
      const v = version(peer);
      if (v) deps[peer] = v;
    }
  }
  const dev: Record<string, string> = {};
  // أنواع الحزم المستخدمة (مثل @types/qrcode) تلزم فحص الأنواع أثناء البناء.
  const typings = Object.keys(deps)
    .map((n) => `@types/${n.startsWith("@") ? n.slice(1).replace("/", "__") : n}`)
    .filter((t) => all[t]);
  for (const name of [...DEV_PACKAGES, ...typings]) {
    const v = version(name);
    if (v) dev[name] = v;
  }
  const sort = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  return (
    json({
      name: `${opts.slug}-store`,
      private: true,
      version: "1.0.0",
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        typecheck: "tsc --noEmit",
        "cf:build": "opennextjs-cloudflare build",
        "cf:preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
        "cf:deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
        "db:generate": "drizzle-kit generate && node scripts/embed-migrations.mjs",
        "db:embed": "node scripts/embed-migrations.mjs",
        "db:migrate": "drizzle-kit migrate",
        check: "npm run typecheck && npm run build",
      },
      engines: { node: ">=20" },
      dependencies: sort(deps),
      devDependencies: sort(dev),
    }) + "\n"
  );
}
