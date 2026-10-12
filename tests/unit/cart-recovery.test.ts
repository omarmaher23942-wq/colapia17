import { describe, expect, it } from "vitest";
import { recoveryMessage } from "@/components/dashboard/overview/AbandonedCarts";

const cart = { name: "منى", firstItem: "فستان كتان", itemsCount: 2, restoreUrl: "https://nova.colapia.com/cart/restore?c=1&t=x" };

describe("cart recovery message", () => {
  it("uses the store template and always appends the restore link", () => {
    const m = recoveryMessage("أهلًا {name}، لاحظنا إنك سبت {items} في السلة.", "نوفا", cart, null);
    expect(m).toContain("أهلًا منى");
    expect(m).toContain("«فستان كتان» ومنتجات أخرى");
    expect(m.endsWith(cart.restoreUrl)).toBe(true);
  });

  it("adds the chosen code to the message and the link", () => {
    const m = recoveryMessage(null, "نوفا", { ...cart, name: null }, { code: "BACK10", label: "خصم 10%" });
    expect(m).toContain("أهلاً بك، معك نوفا");
    expect(m).toContain("بالكود BACK10");
    expect(m).toContain("&promo=BACK10");
  });
});
