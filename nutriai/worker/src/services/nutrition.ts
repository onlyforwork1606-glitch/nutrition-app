import type { Env } from "../types";
import { logger } from "../logger";
import {
  norm,
  similarity,
  parseGrams,
  scaleMacros,
  round,
  type Macro,
} from "./nutritionMath";
import { CONFIDENCE_THRESHOLD } from "../config";

export interface VisionFoodInput {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  confidence?: number;
}

export type FoodSource = "ifct" | "usda" | "curated" | "ai";

export interface EnrichedFood {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  confidence: number;
  source: FoodSource;
  foodId?: string;
  needsConfirmation: boolean;
}

interface FoodRow {
  id: string;
  name: string;
  aliases?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  source: string;
}

/**
 * Staged nutrition pipeline:
 *   Food Detection → Portion Estimation → Nutrition DB Lookup → Macro Calculation
 * If a matching food exists in the database, its verified values are used and the
 * vision model's numbers are discarded (Gemma never invents when a match exists).
 */
export class NutritionService {
  constructor(private env: Env) {}

  async seedIfEmpty() {
    const count = await this.env.DB.prepare("SELECT COUNT(*) c FROM food_db").first<{ c: number }>();
    if (count && count.c > 0) return;
    const now = Date.now();
    const all = [...IFCT_FOODS, ...CURATED_FOODS];
    const stmt = this.env.DB.prepare(
      `INSERT OR REPLACE INTO food_db
       (id, name, aliases, portion, calories, protein, carbs, fat, fiber, source, created_at)
       VALUES (?, ?, ?, '100 g', ?, ?, ?, ?, ?, ?, ?)`
    );
    const rows = all.map((f) =>
      stmt.bind(
        crypto.randomUUID(),
        f.name,
        f.aliases ?? "",
        f.calories,
        f.protein,
        f.carbs,
        f.fat,
        f.fiber,
        f.source,
        now
      )
    );
    await this.env.DB.batch(rows);
  }

  async enrich(foods: VisionFoodInput[]): Promise<EnrichedFood[]> {
    return Promise.all(foods.map((f) => this.process(f)));
  }

  private async process(f: VisionFoodInput): Promise<EnrichedFood> {
    const grams = parseGrams(f.portion) ?? 100;

    // Stage 3: Nutrition DB Lookup (priority: IFCT / curated in D1)
    const match = await this.fuzzyMatch(f.name);
    if (match && match.score >= 0.6) {
      const macros = scaleMacros(rowToMacro(match.row), grams);
      const confidence = round(Math.max(f.confidence ?? 0.5, match.score));
      return {
        name: f.name,
        portion: f.portion,
        ...macros,
        confidence,
        source: match.source as FoodSource,
        foodId: match.row.id,
        needsConfirmation: confidence < CONFIDENCE_THRESHOLD,
      };
    }

    // Priority 2: USDA FoodData Central
    if (this.env.USDA_API_KEY) {
      const usda = await this.usdaLookup(f.name);
      if (usda && usda.score >= 0.6) {
        const macros = scaleMacros(usda.per100, grams);
        const confidence = round(Math.max(f.confidence ?? 0.5, usda.score));
        return {
          name: f.name,
          portion: f.portion,
          ...macros,
          confidence,
          source: "usda",
          foodId: usda.id,
          needsConfirmation: confidence < CONFIDENCE_THRESHOLD,
        };
      }
    }

    // No verified match → use the model's estimate, flagged for confirmation.
    return {
      name: f.name,
      portion: f.portion,
      calories: round(f.calories),
      protein: round(f.protein),
      carbs: round(f.carbs),
      fat: round(f.fat),
      fiber: round(f.fiber),
      confidence: f.confidence ?? 0.4,
      source: "ai",
      needsConfirmation: true,
    };
  }

  private async fuzzyMatch(name: string): Promise<{ row: FoodRow; score: number; source: string } | null> {
    const nq = norm(name);
    try {
      const res = await this.env.DB.prepare(
        "SELECT * FROM food_db WHERE name LIKE ? OR aliases LIKE ? LIMIT 25"
      )
        .bind(`%${nq}%`, `%${nq}%`)
        .all<FoodRow>();
      let best: FoodRow | null = null;
      let bestScore = 0;
      for (const r of res.results ?? []) {
        const s = Math.max(
          similarity(nq, norm(r.name)),
          r.aliases ? similarity(nq, norm(r.aliases)) : 0
        );
        if (s > bestScore) {
          bestScore = s;
          best = r;
        }
      }
      if (best && bestScore >= 0.4) return { row: best, score: bestScore, source: best.source };
    } catch (e) {
      logger.error("d1", e, { op: "fuzzyMatch", name });
    }
    return null;
  }

  private async usdaLookup(
    name: string
  ): Promise<{ id: string; per100: Macro; score: number } | null> {
    try {
      const url =
        `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${this.env.USDA_API_KEY}` +
        `&query=${encodeURIComponent(name)}&pageSize=1&dataType=Foundation,SR%20Legacy`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = (await res.json()) as any;
      const food = json?.foods?.[0];
      if (!food) return null;
      const ns = food.foodNutrients ?? [];
      const get = (ids: number[]) => {
        for (const id of ids) {
          const n = ns.find((x: any) => x.nutrientId === id || x.nutrient?.id === id);
          if (n) return Number(n.value ?? n.amount ?? 0);
        }
        return 0;
      };
      const per100: Macro = {
        calories: get([1008, 2047]),
        protein: get([1003, 203]),
        fat: get([1004, 204]),
        carbs: get([1005, 205]),
        fiber: get([1079, 291]),
      };
      if (!per100.calories && !per100.protein && !per100.carbs) return null;
      return { id: String(food.fdcId), per100, score: 0.8 };
    } catch (e) {
      logger.error("usda", e, { name });
      return null;
    }
  }
}

function rowToMacro(r: FoodRow): Macro {
  return { calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat, fiber: r.fiber };
}

/* ----------------------- Indian Food Composition Tables ----------------------- */
interface SeedFood {
  name: string;
  aliases?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  source: "ifct" | "curated";
}

const IFCT_FOODS: SeedFood[] = [
  { name: "white rice cooked", aliases: "rice,boiled rice,chawal", calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, source: "ifct" },
  { name: "brown rice cooked", aliases: "brown rice", calories: 123, protein: 2.7, carbs: 26, fat: 1, fiber: 1.6, source: "ifct" },
  { name: "basmati rice cooked", aliases: "basmati", calories: 121, protein: 2.9, carbs: 25, fat: 0.4, fiber: 0.4, source: "ifct" },
  { name: "chapati", aliases: "roti,phulka,fulka", calories: 104, protein: 3, carbs: 21, fat: 1, fiber: 3, source: "ifct" },
  { name: "paratha", aliases: "alu paratha", calories: 260, protein: 7, carbs: 32, fat: 12, fiber: 3, source: "ifct" },
  { name: "naan", aliases: "", calories: 280, protein: 9, carbs: 42, fat: 8, fiber: 2, source: "ifct" },
  { name: "idli", aliases: "", calories: 78, protein: 2.5, carbs: 16, fat: 0.2, fiber: 1, source: "ifct" },
  { name: "dosa", aliases: "plain dosa", calories: 110, protein: 3.5, carbs: 18, fat: 2.5, fiber: 1.5, source: "ifct" },
  { name: "sambar", aliases: "", calories: 60, protein: 2.5, carbs: 9, fat: 1.5, fiber: 2.5, source: "ifct" },
  { name: "dal", aliases: "toor dal,arhar dal", calories: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 8, source: "ifct" },
  { name: "chana dal", aliases: "channa dal", calories: 130, protein: 8, carbs: 22, fat: 2, fiber: 6, source: "ifct" },
  { name: "rajma", aliases: "kidney beans", calories: 120, protein: 8, carbs: 22, fat: 0.5, fiber: 7, source: "ifct" },
  { name: "chole", aliases: "chickpea,chana", calories: 130, protein: 8, carbs: 22, fat: 2, fiber: 7, source: "ifct" },
  { name: "paneer", aliases: "cottage cheese", calories: 265, protein: 18, carbs: 1.2, fat: 20, fiber: 0, source: "ifct" },
  { name: "curd", aliases: "yogurt,dahi", calories: 61, protein: 3.2, carbs: 4.7, fat: 3.3, fiber: 0, source: "ifct" },
  { name: "ghee", aliases: "clarified butter", calories: 900, protein: 0, carbs: 0, fat: 100, fiber: 0, source: "ifct" },
  { name: "potato", aliases: "aloo", calories: 87, protein: 2, carbs: 20, fat: 0.1, fiber: 1.5, source: "ifct" },
  { name: "aloo bhaji", aliases: "aloo ki sabzi", calories: 120, protein: 2.5, carbs: 18, fat: 4, fiber: 2.5, source: "ifct" },
  { name: "onion", aliases: "pyaz", calories: 40, protein: 1.1, carbs: 9, fat: 0.1, fiber: 1.7, source: "ifct" },
  { name: "tomato", aliases: "tamatar", calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, source: "ifct" },
  { name: "brinjal", aliases: "baingan,eggplant", calories: 25, protein: 1, carbs: 6, fat: 0.2, fiber: 3, source: "ifct" },
  { name: "cauliflower", aliases: "gobhi", calories: 25, protein: 1.9, carbs: 5, fat: 0.3, fiber: 2, source: "ifct" },
  { name: "spinach", aliases: "palak", calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, source: "ifct" },
  { name: "carrot", aliases: "gajar", calories: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8, source: "ifct" },
  { name: "banana", aliases: "kela", calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, source: "ifct" },
  { name: "apple", aliases: "seb", calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, source: "ifct" },
  { name: "mango", aliases: "aam", calories: 60, protein: 0.8, carbs: 15, fat: 0.4, fiber: 1.6, source: "ifct" },
  { name: "papaya", aliases: "", calories: 43, protein: 0.5, carbs: 11, fat: 0.3, fiber: 1.7, source: "ifct" },
  { name: "orange", aliases: "santra", calories: 47, protein: 0.9, carbs: 12, fat: 0.1, fiber: 2.4, source: "ifct" },
  { name: "guava", aliases: "amrood", calories: 68, protein: 2.6, carbs: 14, fat: 1, fiber: 5.4, source: "ifct" },
  { name: "egg", aliases: "anda,boiled egg", calories: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0, source: "ifct" },
  { name: "chicken breast", aliases: "chicken", calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, source: "ifct" },
  { name: "chicken curry", aliases: "", calories: 180, protein: 16, carbs: 6, fat: 10, fiber: 1, source: "ifct" },
  { name: "mutton", aliases: "goat meat,lamb", calories: 190, protein: 19, carbs: 0, fat: 13, fiber: 0, source: "ifct" },
  { name: "fish", aliases: "pomfret,rohu", calories: 130, protein: 18, carbs: 0, fat: 6, fiber: 0, source: "ifct" },
  { name: "prawn", aliases: "shrimp,jheenga", calories: 99, protein: 21, carbs: 1, fat: 1.5, fiber: 0, source: "ifct" },
  { name: "besan", aliases: "gram flour", calories: 360, protein: 20, carbs: 58, fat: 6, fiber: 11, source: "ifct" },
  { name: "wheat flour", aliases: "atta", calories: 340, protein: 12, carbs: 72, fat: 1.5, fiber: 10, source: "ifct" },
  { name: "sugar", aliases: "chini", calories: 387, protein: 0, carbs: 100, fat: 0, fiber: 0, source: "ifct" },
  { name: "jaggery", aliases: "gud", calories: 380, protein: 0.4, carbs: 95, fat: 0.1, fiber: 0, source: "ifct" },
  { name: "milk", aliases: "doodh,whole milk", calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0, source: "ifct" },
  { name: "almonds", aliases: "badam", calories: 579, protein: 21, carbs: 22, fat: 50, fiber: 12.5, source: "ifct" },
  { name: "cashew", aliases: "kaju", calories: 553, protein: 18, carbs: 30, fat: 44, fiber: 3.3, source: "ifct" },
  { name: "peanut", aliases: "moongphali,groundnut", calories: 567, protein: 26, carbs: 16, fat: 49, fiber: 8, source: "ifct" },
  { name: "oats cooked", aliases: "oatmeal,dalia", calories: 71, protein: 2.5, carbs: 12, fat: 1.5, fiber: 1.7, source: "ifct" },
  { name: "poha", aliases: "flattened rice", calories: 350, protein: 8, carbs: 70, fat: 2, fiber: 3, source: "ifct" },
  { name: "upma", aliases: "suji upma", calories: 130, protein: 3, carbs: 22, fat: 3.5, fiber: 1.5, source: "ifct" },
  { name: "biryani", aliases: "chicken biryani", calories: 180, protein: 9, carbs: 22, fat: 6, fiber: 1, source: "ifct" },
  { name: "samosa", aliases: "", calories: 260, protein: 5, carbs: 30, fat: 14, fiber: 2.5, source: "ifct" },
  { name: "broccoli", aliases: "", calories: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6, source: "ifct" },
  { name: "sweet potato", aliases: "shakarkandi", calories: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3, source: "ifct" },
];

const CURATED_FOODS: SeedFood[] = [
  { name: "salmon", aliases: "", calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, source: "curated" },
  { name: "quinoa cooked", aliases: "quinoa", calories: 120, protein: 4.4, carbs: 21, fat: 1.9, fiber: 2.8, source: "curated" },
  { name: "dark chocolate", aliases: "chocolate", calories: 546, protein: 4.9, carbs: 46, fat: 31, fiber: 7, source: "curated" },
  { name: "olive oil", aliases: "", calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, source: "curated" },
  { name: "tofu", aliases: "", calories: 76, protein: 8, carbs: 1.9, fat: 4.8, fiber: 0.3, source: "curated" },
  { name: "avocado", aliases: "", calories: 160, protein: 2, carbs: 9, fat: 15, fiber: 7, source: "curated" },
];
