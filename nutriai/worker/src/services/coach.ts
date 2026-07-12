import type { Env, NutritionContext, CoachResponse } from "../types";
import { Repo } from "./db";
import { complete } from "./openrouter";
import {
  COACH_SYSTEM_PROMPT,
  COACH_CHAT_PROMPT,
  AI_CONFIG,
} from "../config";
import { logger } from "../logger";

export class CoachService {
  private repo: Repo;
  constructor(private env: Env) {
    this.repo = new Repo(env);
  }

  private contextBlock(ctx: NutritionContext): string {
    return `NUTRITION CONTEXT (today):
Weight: ${ctx.weight ?? "n/a"} g / Goal: ${ctx.goalWeight ?? "n/a"} g
Calories: ${ctx.caloriesConsumed ?? 0} / ${ctx.calorieGoal ?? "n/a"} kcal
Protein: ${ctx.proteinConsumed ?? 0} / ${ctx.proteinGoal ?? "n/a"} g
Water: ${ctx.waterMl ?? 0} / ${ctx.waterGoalMl ?? "n/a"} ml
Meals: ${JSON.stringify(ctx.meals ?? [])}`;
  }

  async chat(
    userId: string,
    message: string,
    date: string,
    requestId: string,
    ctxJson?: string,
    history?: { role: "user" | "assistant"; content: string }[]
  ): Promise<CoachResponse> {
    try {
      await this.repo.addCoachMessage(userId, "user", message);
    } catch (e) {
      logger.error("d1", e, { op: "addCoachMessage", userId });
    }

    let systemPrompt = `${COACH_SYSTEM_PROMPT}\n${COACH_CHAT_PROMPT}`;
    if (ctxJson) {
      systemPrompt += `\nNUTRITION CONTEXT (use ONLY this data, never estimate from images):\n${ctxJson}`;
    } else {
      try {
        const ctx = await this.repo.buildContext(userId, date);
        systemPrompt += `\nNUTRITION CONTEXT (today):\n${this.contextBlock(ctx)}`;
      } catch (e) {
        logger.error("d1", e, { op: "buildContext", userId });
      }
    }

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...(history ?? []).map((h) => ({ role: h.role, content: h.content })),
      { role: "user" as const, content: message },
    ];

    const res = await complete(
      this.env,
      [AI_CONFIG.coachModel, ...AI_CONFIG.coachFallbacks],
      messages,
      { temperature: AI_CONFIG.coachTemperature, maxTokens: AI_CONFIG.coachMaxTokens },
      requestId
    );
    try {
      await this.repo.addCoachMessage(userId, "assistant", res.content);
    } catch (e) {
      logger.error("d1", e, { op: "addCoachMessage", userId });
    }
    logger.info("coach_response", { requestId, userId, tokens: res.usage.total_tokens });
    return { message: res.content };
  }

  async report(userId: string, kind: "daily" | "weekly" | "monthly", requestId: string): Promise<string> {
    const ctx = await this.repo.buildContext(userId, new Date().toISOString().slice(0, 10));
    const prompt =
      kind === "weekly"
        ? `WEEKLY REPORT REQUEST\n${this.contextBlock(ctx)}`
        : kind === "monthly"
        ? `MONTHLY REPORT REQUEST\n${this.contextBlock(ctx)}`
        : `DAILY REPORT REQUEST\n${this.contextBlock(ctx)}`;
    const res = await complete(
      this.env,
      [AI_CONFIG.coachModel, ...AI_CONFIG.coachFallbacks],
      [
        { role: "system", content: COACH_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      { temperature: AI_CONFIG.coachTemperature, maxTokens: AI_CONFIG.coachMaxTokens },
      requestId
    );
    return res.content;
  }
}
