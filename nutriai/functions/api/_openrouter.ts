/**
 * Shared OpenRouter helper for NutriAI Pages Functions.
 *
 * This module is NOT a route (its filename is underscore-prefixed) — it is
 * imported by the /api/vision and /api/chat Functions only. It keeps the
 * OpenRouter key server-side: the browser never talks to OpenRouter directly,
 * it only calls these Pages Functions.
 */

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const SITE_URL = "https://nutriai.app";
export const APP_NAME = "NutriAI";

/** Vision (food recognition) model chain — primary first, then fallbacks.
 *  Both models are confirmed multimodal (accept image_url) on the free tier. */
export const VISION_MODELS = [
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "google/gemma-4-26b-a4b-it:free",
];

/** Nutrition coach (chat) model chain — primary first, then fallbacks. */
export const COACH_MODELS = [
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

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

export const COACH_CHAT_PROMPT = `Respond as the user's personal nutrition coach.
Use the provided nutrition context to give specific, practical, concise advice.
You NEVER estimate calories from images — you only reason about the data provided.`;

/**
 * Call OpenRouter, trying each model in turn. On a rate-limit / HTTP error we
 * fall through to the next model so the free tier survives transient outages.
 */
export async function callOpenRouter(
  apiKey: string,
  models: string[],
  messages: unknown[],
  opts: { temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<any> {
  let lastError: unknown = new Error("All OpenRouter models failed.");

  for (const model of models) {
    try {
      const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": SITE_URL,
          "X-Title": APP_NAME,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: opts.temperature ?? 0.5,
          max_tokens: opts.maxTokens ?? 1000,
          ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        lastError = new Error(`OpenRouter ${res.status}: ${text.slice(0, 200)}`);
        // Try the next model on any failure (rate-limit, outage, 4xx/5xx).
        continue;
      }

      return await res.json();
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError;
}

/** Pull a JSON object out of a model response, tolerating code fences. */
export function extractJson(text: string): any {
  let t = (text ?? "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end >= 0) t = t.slice(start, end + 1);
  return JSON.parse(t);
}
