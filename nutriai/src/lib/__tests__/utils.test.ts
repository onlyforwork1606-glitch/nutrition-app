import { describe, it, expect } from "vitest";
import { formatNumber } from "../utils";

describe("formatNumber", () => {
  it("formats integers without decimals", () => {
    expect(formatNumber(1234)).toBe("1,234");
  });
  it("formats decimals rounding to 1 place", () => {
    expect(formatNumber(12.34, 1)).toBe("12.3");
  });
  it("handles zero", () => {
    expect(formatNumber(0)).toBe("0");
  });
});
