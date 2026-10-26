// source.ts — شجرة ملفات المنصة التي يُجمع منها مشروع العميل (delivery/build.ts).
//
// - محلياً وفي CI: الملفات على القرص (localSource).
// - على Cloudflare Workers لا توجد ملفات المشروع وقت التشغيل: تُقرأ مرة واحدة من أرشيف مستودع GitHub بنفس الـ commit
//   المنشور (githubSource) بتوكن STORES_GITHUB_TOKEN (صلاحية Contents: Read على مستودع المنصة) وSTORES_GITHUB_REPO.
// كلاهما يعرض نفس الواجهة، فالتتبع والتجميع واحد.
import { posix } from "node:path";

export type SourceTree = {
  /** كل الملفات تحت مجلد (مسارات نسبية بـ /)، أو [] إن لم يوجد. */
  list(dir: string): Promise<string[]>;
  isFile(path: string): boolean;
  read(path: string): Promise<string>;
  readBytes(path: string): Promise<Uint8Array>;
  /** إصدار حزمة مثبّتة محلياً (node_modules) إن وُجد؛ الأرشيف لا يحمل node_modules. */
  installedVersion(name: string): string | null;
};

export async function localSource(root: string): Promise<SourceTree> {
  const fs = await import("node:fs");
  const { join, dirname } = await import("node:path");
  const walk = (dir: string): string[] => {
    const abs = join(root, dir);
    if (!fs.existsSync(abs)) return [];
    const out: string[] = [];
    for (const name of fs.readdirSync(abs)) {
      const rel = `${dir}/${name}`;
      if (fs.statSync(join(root, rel)).isDirectory()) out.push(...walk(rel));
      else out.push(rel);
    }
    return out;
  };
  return {
    list: async (dir) => walk(dir),
    isFile: (p) => {
      const abs = join(root, p);
      return fs.existsSync(abs) && fs.statSync(abs).isFile();
    },
    read: (p) => fs.promises.readFile(join(root, p), "utf8"),
    readBytes: async (p) => new Uint8Array(await fs.promises.readFile(join(root, p))),
    installedVersion: (name) => {
      for (const base of [join(root, "node_modules"), join(dirname(root), "node_modules")]) {
        const p = join(base, name, "package.json");
        if (!fs.existsSync(p)) continue;
        try {
          return (JSON.parse(fs.readFileSync(p, "utf8")) as { version?: string }).version ?? null;
        } catch {
          return null;
        }
      }
      return null;
    },
  };
}

/** ما يلزم التوليد من الأرشيف فقط (لا وثائق المنصة ولا مجلدات المتاجر ولا لقطات drizzle المنصة). */
const KEEP = /^(src\/|delivery\/overlay\/|stores\/|public\/(sounds|demo\/media|offline\.html|sw\.js)|package\.json$|package-lock\.json$|postcss\.config\.mjs$)/;

/** يقرأ أرشيف tar (ustar/pax كما يولّده GitHub) إلى خريطة مسار ← بايتات، بعد حذف المجلد الأول (owner-repo-sha/). */
export function untar(buf: Uint8Array, keep: (path: string) => boolean = () => true): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  const dec = new TextDecoder();
  const str = (o: number, n: number) => dec.decode(buf.subarray(o, o + n)).replace(/\0.*$/s, "");
  let off = 0;
  let longName: string | null = null;
  while (off + 512 <= buf.length) {
    if (buf.subarray(off, off + 512).every((b) => b === 0)) break;
    const size = parseInt(str(off + 124, 12).trim() || "0", 8);
    const type = String.fromCharCode(buf[off + 156] || 48);
    const prefix = str(off + 345, 155);
    const name = longName ?? (prefix ? `${prefix}/${str(off, 100)}` : str(off, 100));
    longName = null;
    const body = off + 512;
    if (type === "x") {
      // سجل pax: «طول مفتاح=قيمة\n»؛ المفتاح path يحمل الاسم الطويل للملف التالي.
      const m = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(dec.decode(buf.subarray(body, body + size)));
      if (m) longName = m[1]!;
    } else if (type === "L") {
      longName = dec.decode(buf.subarray(body, body + size)).replace(/\0.*$/s, "");
    } else if (type === "0" || type === "\0") {
      const rel = name.split("/").slice(1).join("/");
      if (rel && keep(rel)) files.set(posix.normalize(rel), buf.slice(body, body + size));
    }
    off = body + Math.ceil(size / 512) * 512;
  }
  return files;
}

export function memorySource(files: Map<string, Uint8Array>): SourceTree {
  const dec = new TextDecoder();
  const get = (p: string) => {
    const f = files.get(p);
    if (!f) throw new Error(`source file not found: ${p}`);
    return f;
  };
  return {
    list: async (dir) => [...files.keys()].filter((p) => p.startsWith(`${dir}/`)).sort(),
    isFile: (p) => files.has(p),
    read: async (p) => dec.decode(get(p)),
    readBytes: async (p) => get(p),
    installedVersion: () => null,
  };
}

/** أرشيف المستودع عند commit محدد (أو main) من GitHub، مفكوكاً في الذاكرة. */
export async function githubSource(repo: string, token: string, ref: string): Promise<SourceTree> {
  const r = await fetch(`https://api.github.com/repos/${repo}/tarball/${encodeURIComponent(ref)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "colapia" },
    signal: AbortSignal.timeout(45_000),
  });
  if (!r.ok || !r.body) throw new Error(`github tarball ${r.status}`);
  const tar = new Uint8Array(await new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
  return memorySource(untar(tar, (p) => KEEP.test(p)));
}

/** مصدر ملفات المنصة الحالية: القرص إن وُجد المشروع فيه، وإلا مستودع GitHub بنفس الـ commit المنشور. */
export async function platformSource(): Promise<SourceTree> {
  const local = await localSource(process.cwd()).catch(() => null);
  if (local?.isFile("src/app/layout.tsx") && local.isFile("package.json")) return local;
  const token = process.env.STORES_GITHUB_TOKEN;
  const repo = process.env.STORES_GITHUB_REPO;
  if (!token || !repo) throw new Error("project files are not available here: set STORES_GITHUB_TOKEN and STORES_GITHUB_REPO");
  return githubSource(repo, token, process.env.BUILD_COMMIT_SHA || "main");
}
