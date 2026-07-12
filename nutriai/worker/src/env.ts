import { AI_CONFIG } from "./config";

export const MODELS = {
  vision: AI_CONFIG.visionModel,
  coach: AI_CONFIG.coachModel,
};

export const LIMITS = {
  /** Free OpenRouter: 50 req/day, 20 req/min. With $10 credits: 1000/day. */
  freeDailyRequests: 50,
  creditedDailyRequests: 1000,
  perMinuteRequests: 20,
  maxImageBytes: 10 * 1024 * 1024, // 10 MB
  maxImageDimension: 2048,
  maxCoachHistory: 30,
  requestTimeoutMs: 25_000,
};
