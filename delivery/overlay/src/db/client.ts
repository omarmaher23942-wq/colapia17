// client.ts — اتصال قاعدة متجرك (Neon عبر HTTP). يُنشأ عند أول استخدام، فيُبنى المشروع وتفتح صفحة /setup حتى قبل ربط
// القاعدة، وتشرح كيف يُربط.
import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { resolveDatabaseUrl } from "@/lib/env";
import * as schema from "./schema";

function connect() {
  return drizzle({ client: neon(resolveDatabaseUrl()), schema, casing: "snake_case" });
}

export type DB = ReturnType<typeof connect>;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("قاعدة البيانات غير مربوطة بعد. افتحوا /setup لإكمال الإعداد.");
    this.name = "DatabaseNotConfiguredError";
  }
}

export const isDatabaseConfigured = () => Boolean(resolveDatabaseUrl());

let instance: DB | null = null;
let instanceUrl = "";

export const db: DB = new Proxy({} as DB, {
  get(_t, prop) {
    const url = resolveDatabaseUrl();
    if (!url) throw new DatabaseNotConfiguredError();
    if (!instance || instanceUrl !== url) {
      instance = connect();
      instanceUrl = url;
    }
    const v = (instance as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(instance) : v;
  },
});
