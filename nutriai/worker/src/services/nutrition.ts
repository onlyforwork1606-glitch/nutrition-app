import type { Env, VisionFood } from "../types";

/**
 * Nutrition engine: reconciles AI-estimated foods against a curated
 * food database so values come from real data, not hallucination.
 */
export class NutritionService {
  constructor(private env: Env) {}

  /** Seed a curated food table once (idempotent). */
  async seedIfEmpty() {
    const count = await this.env.DB.prepare("SELECT COUNT(*) c FROM food_db").first<{ c: number }>();
    if (count && count.c > 0) return;
    const now = Date.now();
    const stmt = this.env.DB.prepare(
      `INSERT OR REPLACE INTO food_db
       (id, name, aliases, portion, calories, protein, carbs, fat, fiber, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'curated', ?)`
    );
    const rows = CURATED_FOODS.map((f) =>
      stmt.bind(
        crypto.randomUUID(),
        f.name,
        f.aliases ?? "",
        f.portion,
        f.calories,
        f.protein,
        f.carbs,
        f.fat,
        f.fiber,
        now
      )
    );
    await this.env.DB.batch(rows);
  }

  /** Normalize a food name for matching. */
  private norm(s: string): string {
    return s.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  }

  /** Fuzzy match a detected food to the curated DB. */
  async enrich(foods: VisionFood[]): Promise<VisionFood[]> {
    const out: VisionFood[] = [];
    for (const food of foods) {
      const nq = this.norm(food.name);
      const rows = await this.env.DB.prepare(
        "SELECT * FROM food_db WHERE name LIKE ? OR aliases LIKE ? LIMIT 5"
      )
        .bind(`%${nq}%`, `%${nq}%`)
        .all<any>();
      const best = this.pickBest(nq, rows.results ?? []);
      if (best) {
        // scale DB per-100g value to the AI-estimated portion when possible
        const factor = this.scaleFactor(food.portion, best.portion);
        out.push({
          name: food.name,
          portion: food.portion,
          calories: round(best.calories * factor),
          protein: round(best.protein * factor),
          carbs: round(best.carbs * factor),
          fat: round(best.fat * factor),
          fiber: round(best.fiber * factor),
          confidence: Math.max(food.confidence ?? 0.8, 0.95),
          source: "db",
          foodId: best.id,
        });
      } else {
        out.push({ ...food, source: "ai" });
      }
    }
    return out;
  }

  private pickBest(nq: string, rows: any[]): any | null {
    let best: any = null;
    let bestScore = 0;
    for (const r of rows) {
      const score = this.similarity(nq, this.norm(r.name));
      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }
    return bestScore >= 0.6 ? best : null;
  }

  private similarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (b.includes(a) || a.includes(b)) return 0.85;
    const dist = levenshtein(a, b);
    const max = Math.max(a.length, b.length);
    return 1 - dist / max;
  }

  /** Map an AI portion string to a scaling factor vs the DB per-100g baseline. */
  private scaleFactor(portion: string, dbPortion: string): number {
    const qty = parseGrams(portion) ?? parseGrams(dbPortion) ?? 100;
    return qty / 100;
  }
}

function parseGrams(s: string): number | null {
  if (!s) return null;
  const m = s.match(/(\d+(?:\.\d+)?)\s*(g|grams?|ml|pieces?|pcs|cups?|tbsp|tsp|oz|kg)?/i);
  if (!m) return null;
  let v = parseFloat(m[1]);
  const unit = (m[2] || "").toLowerCase();
  if (unit === "kg") v *= 1000;
  if (unit === "oz") v *= 28.35;
  if (unit === "cups") v *= 240;
  if (unit === "tbsp") v *= 15;
  if (unit === "tsp") v *= 5;
  return v;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function levenshtein(a: string, b: string): number {
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

interface Curated {
  name: string;
  aliases?: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

const CURATED_FOODS: Curated[] = [
  { name: "white rice cooked", aliases: "rice,boiled rice", portion: "100 g", calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4 },
  { name: "brown rice cooked", aliases: "brown rice", portion: "100 g", calories: 123, protein: 2.7, carbs: 26, fat: 1, fiber: 1.6 },
  { name: "chapati", aliases: "roti,fulka,phulka", portion: "1 piece", calories: 104, protein: 3, carbs: 21, fat: 1, fiber: 3 },
  { name: "dal", aliases: "lentils,toor dal,moong dal", portion: "100 g", calories: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 8 },
  { name: "chicken breast", aliases: "chicken,grilled chicken", portion: "100 g", calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 },
  { name: "egg whole", aliases: "egg,boiled egg", portion: "1 piece", calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, fiber: 0 },
  { name: "banana", aliases: "", portion: "1 piece", calories: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3.1 },
  { name: "apple", aliases: "", portion: "1 piece", calories: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4.4 },
  { name: "paneer", aliases: "cottage cheese", portion: "100 g", calories: 265, protein: 18, carbs: 1.2, fat: 20, fiber: 0 },
  { name: "potato", aliases: "aloo", portion: "100 g", calories: 77, protein: 2, carbs: 17, fat: 0.1, fiber: 2.2 },
  { name: "yogurt", aliases: "curd,dahi", portion: "100 g", calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3, fiber: 0 },
  { name: "broccoli", aliases: "", portion: "100 g", calories: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6 },
  { name: "salmon", aliases: "", portion: "100 g", calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0 },
  { name: "oats cooked", aliases: "oatmeal", portion: "100 g", calories: 71, protein: 2.5, carbs: 12, fat: 1.5, fiber: 1.7 },
  { name: "almonds", aliases: "", portion: "100 g", calories: 579, protein: 21, carbs: 22, fat: 50, fiber: 12.5 },
  { name: "milk whole", aliases: "milk", portion: "100 ml", calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0 },
];
