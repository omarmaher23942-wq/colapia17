import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** 192 بت عشوائية = 32 حرف base64url. يُخزَّن الـ hash فقط. البحث بالمساواة على فهرس فريد */
export function generateToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}

export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export const isWellFormedToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{32}$/.test(t);