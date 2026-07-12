import type { Env } from "../types";
import { logger } from "../logger";
import { timed } from "../observability";

export interface ORMessage {
  role: "system" | "user" | "assistant";
  content: string | ChatContent[];
}
type ChatContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface CompletionResult {
  content: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model: string;
}

/**
 * Calls OpenRouter. The API key lives ONLY here (server-side secret).
 * Tries the model list in order, falling through on 429 / transient errors.
 */
export async function complete(
  env: Env,
  models: string[],
  messages: ORMessage[],
  opts: { temperature: number; maxTokens: number; signal?: AbortSignal },
  requestId: string
): Promise<CompletionResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  const signal = opts.signal
    ? mergeSignals(opts.signal, controller.signal)
    : controller.signal;

  let lastErr: unknown = null;
  for (const model of models) {
    try {
      const [res, ms] = await timed(async () => {
        const r = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
          method: "POST",
          signal,
          headers: {
            Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": env.FRONTEND_URL,
            "X-Title": "NutriAI",
          },
          body: JSON.stringify({
            model,
            temperature: opts.temperature,
            max_tokens: opts.maxTokens,
            messages,
          }),
        });
        return r;
      });

      if (res.status === 429) {
        lastErr = new Error("rate_limited");
        logger.warn("openrouter_429", { requestId, model });
        continue;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        lastErr = new Error(`openrouter_${res.status}: ${txt}`);
        if (res.status === 401) {
          logger.aiFailure(model, lastErr, { requestId, status: 401 });
          throw new Error("invalid_openrouter_key");
        }
        continue;
      }

      const json = (await res.json()) as any;
      const content: string | undefined = json?.choices?.[0]?.message?.content;
      if (!content) throw new Error("empty_completion");
      logger.info("openrouter_ok", { requestId, model, latencyMs: ms });
      clearTimeout(timeout);
      return {
        content,
        usage: json?.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        model,
      };
    } catch (e) {
      lastErr = e;
    }
  }
  clearTimeout(timeout);
  const final = lastErr instanceof Error ? lastErr : new Error("openrouter_failed");
  logger.aiFailure(models[0], final, { requestId });
  throw final;
}

function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  a.addEventListener("abort", onAbort);
  b.addEventListener("abort", onAbort);
  return ctrl.signal;
}
