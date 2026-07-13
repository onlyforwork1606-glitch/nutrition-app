import { VisionResultSchema, type VisionResult, type FoodItem } from "./types";
import { uid, todayKey } from "./utils";
import { apiClient, ApiError } from "./api";
import { logger } from "./logger";

export class AIError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "AIError";
  }
}

/** Translate a server API error into the UI's expected AIError. */
function toAIError(e: unknown): AIError {
  if (e instanceof ApiError) {
    return new AIError(e.message, e.status);
  }
  return new AIError(e instanceof Error ? e.message : "AI request failed.");
}

export const AIService = {
  /** Vision: analyze a food image via Pages Functions (server calls OpenRouter). */
  async analyzeFoodImage(
    imageDataUrl: string,
    signal?: AbortSignal
  ): Promise<VisionResult> {
    try {
      const data = await apiClient.vision(imageDataUrl, todayKey(), signal);
      const parsed = VisionResultSchema.safeParse({ foods: data.foods });
      if (!parsed.success) {
        logger.aiFailure("gemma-vision", new Error("invalid_vision_result"));
        throw new AIError("AI returned an unreadable result.");
      }
      return parsed.data;
    } catch (e) {
      throw toAIError(e);
    }
  },

  /** Build a compact nutrition context object (kept for compatibility). */
  buildContext(ctx: {
    weight?: number;
    goalWeight?: number;
    caloriesConsumed?: number;
    proteinConsumed?: number;
    calorieGoal?: number;
    proteinGoal?: number;
    waterMl?: number;
    waterGoalMl?: number;
    meals: { type: string; name: string; calories: number; protein: number }[];
    weeklyTrend?: string;
    monthlyTrend?: string;
  }): string {
    return JSON.stringify(ctx, null, 2);
  },

  async dailyCoach(_contextJson?: string, signal?: AbortSignal): Promise<string> {
    return this.chat("Generate today's summary and one actionable suggestion based on my logged data.", undefined, undefined, signal);
  },

  async weeklyCoach(_contextJson?: string, signal?: AbortSignal): Promise<string> {
    return this.chat("Generate my weekly nutrition report from my logged data.", undefined, undefined, signal);
  },

  async monthlyCoach(_contextJson?: string, signal?: AbortSignal): Promise<string> {
    return this.chat("Generate my monthly nutrition report from my logged data.", undefined, undefined, signal);
  },

  async chat(
    message: string,
    contextJson?: string,
    history: { role: "user" | "assistant"; content: string }[] = [],
    signal?: AbortSignal
  ): Promise<string> {
    try {
      const data = await apiClient.chat(message, contextJson, history, signal);
      return data.message;
    } catch (e) {
      logger.aiFailure("gemma-coach", e);
      throw toAIError(e);
    }
  },

  async futureMealPrediction(
    _contextJson: string,
    goal: "protein" | "calories" | "balanced",
    signal?: AbortSignal
  ): Promise<string> {
    return this.chat(
      `Suggest ONE concrete meal to help me hit my ${goal} goal based on my logged data. Be specific with foods and grams.`,
      undefined,
      undefined,
      signal
    );
  },
};

export function visionResultToItems(result: VisionResult): FoodItem[] {
  return result.foods.map((f) => ({
    id: uid(),
    name: f.name,
    portion: f.portion,
    quantity: 1,
    calories: Math.round(f.calories),
    protein: Math.round(f.protein * 10) / 10,
    carbs: Math.round(f.carbs * 10) / 10,
    fat: Math.round(f.fat * 10) / 10,
    fiber: Math.round(f.fiber * 10) / 10,
    confidence: f.confidence,
  }));
}
