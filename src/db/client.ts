import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/lib/env";
import * as schema from "./schema";

// وقت البناء لا توجد أسرار (lib/env.ts): رابط شكلي لا يُتصل به أبداً، فالصفحات كلها ديناميكية.
const sql = neon(env.DATABASE_URL ?? "postgresql://build:build@build.invalid/build");
export const db = drizzle({ client: sql, schema, casing: "snake_case" });
export type DB = typeof db;
