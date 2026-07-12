/** Pure nutrition helpers (no Cloudflare bindings) — unit-testable. */

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/** 0..1 similarity between two normalized food names. */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.9;
  const dist = levenshtein(a, b);
  const max = Math.max(a.length, b.length) || 1;
  return Math.max(0, 1 - dist / max);
}

export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Approximate grams for a typical piece of common foods. */
const PIECE_GRAMS: Record<string, number> = {
  chapati: 40,
  roti: 40,
  phulka: 40,
  fulka: 40,
  idli: 50,
  dosa: 70,
  puri: 45,
  paratha: 120,
  naan: 120,
  banana: 120,
  plantain: 150,
  apple: 150,
  orange: 130,
  egg: 50,
  boiledegg: 50,
  eggwhole: 50,
  tomato: 100,
  onion: 100,
  potato: 150,
  aloo: 150,
  brinjal: 100,
  paneer: 100,
  samosa: 100,
  vada: 60,
};

/** Parse a portion string into grams. Piece counts use PIECE_GRAMS heuristics. */
export function parseGrams(portion: string): number | null {
  if (!portion) return null;
  const p = portion.toLowerCase();
  const qtyMatch = p.match(/(\d+(?:\.\d+)?)/);
  const qty = qtyMatch ? parseFloat(qtyMatch[1]) : 1;

  const unitMatch = p.match(/(g|grams?|gm|ml|pieces?|pcs|pc|cups?|tbsp|tsp|oz|kg|slice|slices?|bowl|bowls?)/);
  const unit = unitMatch ? unitMatch[1] : "";

  let grams = qty;
  if (unit.startsWith("kg")) grams *= 1000;
  else if (unit === "oz") grams *= 28.35;
  else if (unit.startsWith("cup")) grams *= 240;
  else if (unit === "tbsp") grams *= 15;
  else if (unit === "tsp") grams *= 5;
  else if (unit.startsWith("slice")) grams *= 30;
  else if (unit.startsWith("bowl")) grams *= 150;
  else if (unit.startsWith("piece") || unit === "pc" || unit.startsWith("pcs")) {
    // figure out which food the portion refers to via remaining words
    const foodWord = p.replace(/[\d.]+/g, "").replace(unit, "").trim().split(/\s+/)[0] || "";
    grams = (PIECE_GRAMS[foodWord] ?? 80) * qty;
  } else if (!unit) {
    // no unit: try to infer a piece weight from the food word in the string
    const foodWord = p.replace(/[\d.]+/g, "").trim().split(/\s+/)[0] || "";
    if (PIECE_GRAMS[foodWord]) grams = PIECE_GRAMS[foodWord] * qty;
    else return null;
  }
  return Math.round(grams);
}

export interface Macro {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

/** Scale per-100g macros to a target gram weight. */
export function scaleMacros(per100: Macro, grams: number): Macro {
  const f = grams / 100;
  return {
    calories: round(per100.calories * f),
    protein: round(per100.protein * f),
    carbs: round(per100.carbs * f),
    fat: round(per100.fat * f),
    fiber: round(per100.fiber * f),
  };
}

export function round(n: number): number {
  return Math.round(n * 10) / 10;
}
