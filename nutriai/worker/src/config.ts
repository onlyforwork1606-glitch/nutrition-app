/**
 * Centralized AI configuration (mirrors the frontend constants).
 * Swap models here without touching business logic.
 */
export const AI_CONFIG = {
  baseUrl: "", // filled from env at call time
  visionModel: "google/gemma-4-26b-a4b-it:free",
  visionTemperature: 0.2,
  visionMaxTokens: 1200,
  coachModel: "qwen/qwen2.5-72b-instruct:free",
  coachTemperature: 0.6,
  coachMaxTokens: 900,
  visionFallbacks: ["nvidia/nemotron-nano-12b-v2-vl:free"],
  coachFallbacks: [
    "qwen/qwen3-235b-a22b:free",
    "google/gemma-4-26b-a4b-it:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "meta-llama/llama-3.3-70b-instruct:free",
  ],
};

/** Confidence below this triggers a "please confirm" prompt before saving. */
export const CONFIDENCE_THRESHOLD = 0.7;

export const VISION_PROMPT = `You are the VISION stage of a nutrition pipeline.
Step 1 (Food Detection): Identify every visible food item by name.
Step 2 (Portion Estimation): Estimate a realistic serving size/portion for each.
Step 3: Provide your BEST-GUESS macros for each item (they will be
re-verified against a nutrition database and corrected when a match exists,
so never fabricate precise values if unsure — give reasonable estimates).
Return ONLY valid JSON. No markdown. No explanations.`;

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
Always prioritize: Protein, Fibre, Whole foods, Sustainability, Healthy habits.
Never shame users. Never recommend crash diets. Never recommend dangerous supplements.
Always provide practical advice. Keep responses concise. Speak naturally.`;

export const COACH_DAILY_PROMPT = `You are given the user's current nutrition data for today.
Generate: 1) Today's Summary 2) Today's Goal 3) One actionable suggestion 4) One motivational message.
Be specific with numbers. Reference remaining calories and protein.`;

export const COACH_WEEKLY_PROMPT = `Analyze the user's week of nutrition data.
Generate: Strengths, Weaknesses, Suggestions. Be concise and reference concrete trends.`;

export const COACH_MONTHLY_PROMPT = `Analyze the user's month of nutrition data.
Generate: Weight Lost, Body Fat Trend, Protein Consistency, Calories Consistency,
Predicted Goal Date, Risk of Muscle Loss, Suggestions.`;

export const COACH_CHAT_PROMPT = `Respond as the user's personal nutrition coach.
Use the provided nutrition context to give specific, practical, concise advice.
You NEVER estimate calories from images — you only reason about the data provided.`;
