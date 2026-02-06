import { describe, expect, it } from "vitest";
import { isAtBottom, shouldAutoScroll } from "./scroll-utils";

describe("chat scroll utils", () => {
  it("treats the viewport as at bottom within the threshold", () => {
    expect(isAtBottom(510, 1000, 400, 100)).toBe(true);
    expect(isAtBottom(450, 1000, 400, 100)).toBe(false);
  });

  it("auto-scrolls only on first fetch or when already at bottom", () => {
    expect(shouldAutoScroll(true, false)).toBe(true);
    expect(shouldAutoScroll(false, true)).toBe(true);
    expect(shouldAutoScroll(false, false)).toBe(false);
  });

  it("never auto-scrolls when loading older messages while scrolled up", () => {
    expect(shouldAutoScroll(false, false)).toBe(false);
  });
});
