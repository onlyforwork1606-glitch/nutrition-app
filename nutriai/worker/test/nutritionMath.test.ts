import { describe, it, expect } from "vitest";
import {
  similarity,
  levenshtein,
  parseGrams,
  scaleMacros,
  norm,
} from "../src/services/nutritionMath";

describe("nutritionMath", () => {
  it("similarity is 1 for identical names", () => {
    expect(similarity("rice", "rice")).toBe(1);
  });

  it("similarity is high for substrings", () => {
    expect(similarity("white rice", "rice")).toBeGreaterThan(0.8);
  });

  it("levenshtein counts single edits", () => {
    expect(levenshtein("roti", "roti")).toBe(0);
    expect(levenshtein("roti", "rati")).toBe(1);
  });

  it("norm lowercases and strips punctuation and digits", () => {
    expect(norm("Chapati, (1 pc)")).toBe("chapati pc");
  });

  it("parseGrams parses explicit gram units", () => {
    expect(parseGrams("150 g")).toBe(150);
    expect(parseGrams("1.5 kg")).toBe(1500);
  });

  it("parseGrams infers piece weights for known foods", () => {
    expect(parseGrams("2 chapati")).toBe(80); // 40g each
    expect(parseGrams("1 banana")).toBe(120);
  });

  it("scaleMacros scales per-100g values to grams", () => {
    const m = scaleMacros({ calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4 }, 200);
    expect(m.calories).toBe(260);
    expect(m.protein).toBe(5.4);
  });
});
