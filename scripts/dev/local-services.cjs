// local-services.cjs — للتطوير فقط (لا يُحمَّل أبداً في الإنتاج): يُحمَّل بـ NODE_OPTIONS=--require من preview.sh،
// فيوجّه اتصالات التطبيق إلى بدائل محلية دون أي تعديل في كوده:
//  - https://api.local.neon/sql  → Postgres محلي (بروتوكول Neon HTTP نفسه، نصوص خام، ومعاملات db.batch)
//  - https://redis.local/...      → Redis في الذاكرة (بروتوكول Upstash REST، مع ترميز base64)
//  - أي نطاق آخر ينتهي بـ .local  → فشل فوري (QStash وغيره) بدل انتظار الشبكة
// حزمة pg تُثبَّت في مجلد كاش خارج المشروع (DEVSTACK_PG_MODULE) فلا تُضاف لاعتماديات المشروع.
const { Pool } = require(process.env.DEVSTACK_PG_MODULE || "pg");

const PG_URL = process.env.DEVSTACK_PG_URL || "postgresql://postgres@127.0.0.1:5433/colapia";
let pool;
const getPool = () => (pool ??= new Pool({ connectionString: PG_URL, max: 8 }));
const raw = { getTypeParser: () => (v) => v };

function fieldsOf(r) {
  return (r.fields || []).map((f) => ({
    name: f.name,
    tableID: f.tableID,
    columnID: f.columnID,
    dataTypeID: f.dataTypeID,
    dataTypeSize: f.dataTypeSize,
    dataTypeModifier: f.dataTypeModifier,
    format: "text",
  }));
}
function shape(r, arrayMode) {
  return { fields: fieldsOf(r), command: r.command, rowCount: r.rowCount, rows: r.rows, rowAsArray: arrayMode };
}

async function neonSql(body, headers) {
  const arrayMode = String(headers.get("neon-array-mode")) === "true";
  const p = getPool();
  if (Array.isArray(body.queries)) {
    const c = await p.connect();
    try {
      await c.query("BEGIN");
      const results = [];
      for (const q of body.queries) {
        const r = await c.query({ text: q.query, values: q.params, rowMode: arrayMode ? "array" : undefined, types: raw });
        results.push(shape(r, arrayMode));
      }
      await c.query("COMMIT");
      return { results };
    } catch (e) {
      await c.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }
  const r = await p.query({ text: body.query, values: body.params, rowMode: arrayMode ? "array" : undefined, types: raw });
  return shape(r, arrayMode);
}

// ── Redis (subset) ───────────────────────────────────────────────────────────
const store = new Map(); // key -> { v, exp }
const now = () => Date.now();
function getE(k) {
  const e = store.get(k);
  if (!e) return null;
  if (e.exp && e.exp <= now()) { store.delete(k); return null; }
  return e;
}
const str = (x) => (x === null || x === undefined ? null : String(x));
function cmd(args) {
  const [c0, ...a] = args;
  const c = String(c0).toLowerCase();
  switch (c) {
    case "ping": return "PONG";
    case "get": { const e = getE(a[0]); return e && typeof e.v === "string" ? e.v : null; }
    case "set": {
      let exp = 0, nx = false, xx = false, get = false;
      for (let i = 2; i < a.length; i++) {
        const o = String(a[i]).toLowerCase();
        if (o === "ex") exp = now() + Number(a[++i]) * 1000;
        else if (o === "px") exp = now() + Number(a[++i]);
        else if (o === "nx") nx = true;
        else if (o === "xx") xx = true;
        else if (o === "get") get = true;
        else if (o === "keepttl") exp = getE(a[0])?.exp || 0;
      }
      const prev = getE(a[0]);
      if ((nx && prev) || (xx && !prev)) return get ? str(prev?.v) : null;
      store.set(a[0], { v: str(a[1]), exp });
      return get ? str(prev?.v) : "OK";
    }
    case "setex": store.set(a[0], { v: str(a[2]), exp: now() + Number(a[1]) * 1000 }); return "OK";
    case "del": { let n = 0; for (const k of a) if (getE(k)) { store.delete(k); n++; } return n; }
    case "exists": return a.filter((k) => getE(k)).length;
    case "incr": case "incrby": case "decr": case "decrby": {
      const e = getE(a[0]);
      const by = c === "incr" ? 1 : c === "decr" ? -1 : c === "decrby" ? -Number(a[1]) : Number(a[1]);
      const v = Number(e?.v ?? 0) + by;
      store.set(a[0], { v: String(v), exp: e?.exp || 0 });
      return v;
    }
    case "expire": case "pexpire": {
      const e = getE(a[0]); if (!e) return 0;
      e.exp = now() + Number(a[1]) * (c === "expire" ? 1000 : 1); return 1;
    }
    case "ttl": case "pttl": {
      const e = getE(a[0]); if (!e) return -2; if (!e.exp) return -1;
      const ms = e.exp - now(); return c === "ttl" ? Math.ceil(ms / 1000) : ms;
    }
    case "mget": return a.map((k) => { const e = getE(k); return e && typeof e.v === "string" ? e.v : null; });
    case "rpush": case "lpush": {
      const e = getE(a[0]) || { v: [], exp: 0 }; if (!Array.isArray(e.v)) e.v = [];
      const vals = a.slice(1).map(str); if (c === "rpush") e.v.push(...vals); else e.v.unshift(...vals.reverse());
      store.set(a[0], e); return e.v.length;
    }
    case "llen": { const e = getE(a[0]); return e && Array.isArray(e.v) ? e.v.length : 0; }
    case "lrange": {
      const e = getE(a[0]); if (!e || !Array.isArray(e.v)) return [];
      const len = e.v.length; let s = Number(a[1]), t = Number(a[2]);
      if (s < 0) s = len + s; if (t < 0) t = len + t; return e.v.slice(Math.max(0, s), t + 1);
    }
    case "ltrim": {
      const e = getE(a[0]); if (!e || !Array.isArray(e.v)) return "OK";
      const len = e.v.length; let s = Number(a[1]), t = Number(a[2]);
      if (s < 0) s = len + s; if (t < 0) t = len + t; e.v = e.v.slice(Math.max(0, s), t + 1); return "OK";
    }
    case "zadd": {
      const e = getE(a[0]) || { v: new Map(), exp: 0 }; if (!(e.v instanceof Map)) e.v = new Map();
      let i = 1; while (i < a.length && isNaN(Number(a[i]))) i++;
      let n = 0; for (; i + 1 < a.length; i += 2) { if (!e.v.has(a[i + 1])) n++; e.v.set(String(a[i + 1]), Number(a[i])); }
      store.set(a[0], e); return n;
    }
    case "zcount": {
      const e = getE(a[0]); if (!e || !(e.v instanceof Map)) return 0;
      const lo = a[1] === "-inf" ? -Infinity : Number(a[1]); const hi = a[2] === "+inf" ? Infinity : Number(a[2]);
      return [...e.v.values()].filter((s) => s >= lo && s <= hi).length;
    }
    case "zremrangebyscore": {
      const e = getE(a[0]); if (!e || !(e.v instanceof Map)) return 0;
      const lo = a[1] === "-inf" ? -Infinity : Number(a[1]); const hi = a[2] === "+inf" ? Infinity : Number(a[2]);
      let n = 0; for (const [m, s] of e.v) if (s >= lo && s <= hi) { e.v.delete(m); n++; } return n;
    }
    case "hset": {
      const e = getE(a[0]) || { v: {}, exp: 0 }; let n = 0;
      for (let i = 1; i + 1 < a.length; i += 2) { if (!(a[i] in e.v)) n++; e.v[a[i]] = str(a[i + 1]); }
      store.set(a[0], e); return n;
    }
    case "hget": { const e = getE(a[0]); return e?.v?.[a[1]] ?? null; }
    case "hgetall": { const e = getE(a[0]); return e ? Object.entries(e.v).flat() : []; }
    case "keys": { const re = new RegExp("^" + String(a[0]).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"); return [...store.keys()].filter((k) => getE(k) && re.test(k)); }
    case "flushall": store.clear(); return "OK";
    case "evalsha": throw new Error("NOSCRIPT No matching script");
    default: throw new Error(`ERR devstack does not implement '${c}'`);
  }
}
function enc(v, b64) {
  if (!b64) return v;
  if (typeof v === "string") return Buffer.from(v).toString("base64");
  if (Array.isArray(v)) return v.map((x) => enc(x, b64));
  return v;
}
function redisReq(path, body, headers) {
  const b64 = String(headers.get("upstash-encoding")).toLowerCase() === "base64";
  const one = (args) => { try { return { result: enc(cmd(args), b64) }; } catch (e) { return { error: String(e.message || e) }; } };
  if (path.endsWith("/pipeline") || path.endsWith("/multi-exec")) return [200, body.map(one)];
  const r = one(body);
  return [r.error ? 400 : 200, r];
}

const realFetch = globalThis.fetch;
const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async function devstackFetch(input, init) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  let u;
  try { u = new URL(url); } catch { return realFetch(input, init); }
  const headers = new Headers(init?.headers || (typeof input === "object" && input.headers) || {});
  const bodyText = init?.body ? String(init.body) : "";
  if (u.hostname === "api.local.neon") {
    try { return json(200, await neonSql(JSON.parse(bodyText), headers)); }
    catch (e) {
      return json(400, { message: e.message, code: e.code, detail: e.detail, hint: e.hint, position: e.position, severity: e.severity });
    }
  }
  if (u.hostname === "redis.local") {
    const body = bodyText ? JSON.parse(bodyText) : [u.pathname.split("/").filter(Boolean)].flat();
    const [status, out] = redisReq(u.pathname, body, headers);
    return json(status, out);
  }
  if (/(^|\.)local$/.test(u.hostname)) return json(503, { error: "devstack: offline service" });
  return realFetch(input, init);
};
