import { describe, it, expect } from "vitest";
import { isTrustedUploadUrl } from "@/lib/upload-hosts";
import { secretsEqual } from "@/server/passwords";

describe("trusted upload hosts", () => {
  it("accepts UploadThing hosts over https only", () => {
    expect(isTrustedUploadUrl("https://utfs.io/f/abc")).toBe(true);
    expect(isTrustedUploadUrl("https://x7k2.ufs.sh/f/abc")).toBe(true);
    expect(isTrustedUploadUrl("http://utfs.io/f/abc")).toBe(false);
    expect(isTrustedUploadUrl("https://evil.com/utfs.io")).toBe(false);
    expect(isTrustedUploadUrl("https://utfs.io.evil.com/f")).toBe(false);
    expect(isTrustedUploadUrl("not a url")).toBe(false);
  });
});

describe("secretsEqual", () => {
  it("compares in constant time regardless of length and rejects empty secrets", () => {
    expect(secretsEqual("abc", "abc")).toBe(true);
    expect(secretsEqual("abc", "abcd")).toBe(false);
    expect(secretsEqual("", "")).toBe(false);
    expect(secretsEqual("abc", undefined)).toBe(false);
  });
});
