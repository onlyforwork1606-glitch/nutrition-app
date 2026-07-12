/**
 * Centralized AI model + prompt configuration.
 *
 * All model names, endpoints and prompts live here as configurable constants
 * so models can be swapped without touching business logic.
 */

export const AI_CONFIG = {
  baseUrl:
    (import.meta.env.VITE_OPENROUTER_BASE_URL as string | undefined) ??
    "https://openrouter.ai/api/v1",

  siteUrl:
    (import.meta.env.VITE_OPENROUTER_SITE_URL as string | undefined) ??
    "https://nutriai.app",

  appName:
    (import.meta.env.VITE_OPENROUTER_APP_NAME as string | undefined) ?? "NutriAI",

  /** Vision model — food recognition + macro estimation. */
  visionModel: "google/gemma-4-26b-a4b-it:free",
  visionTemperature: 0.2,
  /** Fallback vision models (tried on rate-limit / outage). */
  visionFallbacks: ["nvidia/nemotron-nano-12b-v2-vl:free"],

  /** Nutrition coach — text only, never estimates from images.
   *  Uses the non-deprecated Gemma 4 26B (multimodal, 262K ctx) as primary. */
  coachModel: "google/gemma-4-26b-a4b-it:free",
  coachTemperature: 0.6,
  /** Fallback coach models (tried on rate-limit / outage). */
  coachFallbacks: [
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "meta-llama/llama-3.3-70b-instruct:free",
  ],

  /** Max tokens for the vision model. */
  visionMaxTokens: 1200,
  coachMaxTokens: 900,
} as const;

export const VISION_PROMPT = `Analyze this meal.
Identify every visible food item.
Estimate realistic serving sizes.
Estimate calories.
Estimate protein.
Estimate carbohydrates.
Estimate fats.
Estimate fibre.
If uncertain provide your best estimate.
Never hallucinate impossible values.
Return ONLY valid JSON.
No markdown.
No explanations.`;

export const VISION_OUTPUT_HINT = `Respond strictly with JSON of the shape:
{
  "foods": [
    {
      "name": "Food name",
      "portion": "100 g",
      "calories": 0,
      "protein": 0,
      "fat": 0,
      "carbs": 0,
      "fiber": 0,
      "confidence": 0.95
    }
  ]
}`;

export const COACH_SYSTEM_PROMPT = `You are NutriAI. You are an elite AI Nutrition Coach.

Your personality is similar to a professional dietitian and personal trainer.
You help users lose fat while preserving muscle.

Always prioritize:
- Protein
- Fibre
- Whole foods
- Sustainability
- Healthy habits

Never shame users.
Never recommend crash diets.
Never recommend dangerous supplements.
Always provide practical advice.
Keep responses concise.
Speak naturally.`;

export const COACH_DAILY_PROMPT = `You are given the user's current nutrition data for today.
Generate:
1. Today's Summary
2. Today's Goal
3. One actionable suggestion
4. One motivational message

Be specific with numbers. Reference remaining calories and protein.`;

export const COACH_WEEKLY_PROMPT = `Analyze the user's week of nutrition data.
Generate: Strengths, Weaknesses, Suggestions.
Be concise and reference concrete trends.`;

export const COACH_MONTHLY_PROMPT = `Analyze the user's month of nutrition data.
Generate: Weight Lost, Body Fat Trend, Protein Consistency, Calories Consistency,
Predicted Goal Date, Risk of Muscle Loss, Suggestions.`;

export const COACH_CHAT_PROMPT = `Respond as the user's personal nutrition coach.
Use the provided nutrition context to give specific, practical, concise advice.
You NEVER estimate calories from images — you only reason about the data provided.`;
