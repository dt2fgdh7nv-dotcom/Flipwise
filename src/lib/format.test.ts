import { describe, expect, it } from "vitest";
import { formatEur, parseEurToCents, parsePctToBps } from "./format";

describe("format", () => {
  it("parses euro inputs in Finnish and English styles", () => {
    expect(parseEurToCents("239 000")).toBe(23_900_000);
    expect(parseEurToCents("239,000.50")).toBe(23_900_050);
    expect(parseEurToCents("239 000,50")).toBe(23_900_050);
    expect(parseEurToCents("4,8")).toBe(480);
    expect(parseEurToCents("€ 1 200")).toBe(120_000);
    expect(parseEurToCents("")).toBeNull();
    expect(parseEurToCents("abc")).toBeNull();
  });
  it("parses percentages to bps", () => {
    expect(parsePctToBps("1,5")).toBe(150);
    expect(parsePctToBps("25.5 %")).toBe(2550);
  });
  it("formats euros", () => {
    expect(formatEur(23_900_000)).toBe("€239,000");
    expect(formatEur(null)).toBe("—");
  });
});
