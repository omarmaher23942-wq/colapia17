import { describe, it, expect } from "vitest";
import { canSubscribeToChannel, channels } from "@/server/realtime/events";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("realtime channel authorization", () => {
  const merchantA = { kind: "merchant" as const, merchantId: "m-a", storeIds: [A] };

  it("lets a merchant subscribe only to channels of stores they own", () => {
    expect(canSubscribeToChannel(channels.store(A), merchantA)).toBe(true);
    expect(canSubscribeToChannel(channels.store(B), merchantA)).toBe(false);
    expect(canSubscribeToChannel(channels.presenceStore(B), merchantA)).toBe(false);
  });

  it("scopes order channels by store, so equal codes in two stores never collide", () => {
    expect(channels.order(A, "CLP-ABCDE")).not.toBe(channels.order(B, "CLP-ABCDE"));
    expect(canSubscribeToChannel(channels.order(A, "CLP-ABCDE"), merchantA)).toBe(true);
    expect(canSubscribeToChannel(channels.order(B, "CLP-ABCDE"), merchantA)).toBe(false);
  });

  it("never authorizes a merchant for another store's presence or order channels", () => {
    expect(canSubscribeToChannel(channels.presenceStore(A), merchantA)).toBe(true);
    expect(canSubscribeToChannel(channels.merchant("m-b"), merchantA)).toBe(false);
  });
});
