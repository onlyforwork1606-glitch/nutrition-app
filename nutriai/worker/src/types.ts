import type { Context } from "hono";

export type AppEnv = { Bindings: Env; Variables: { requestId: string } };
export type AppContext = Context<AppEnv>;

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  KV: KVNamespace;
  COACH_DO: DurableObjectNamespace;
  ASSETS: Fetcher;
  OPENROUTER_API_KEY: string;
  OPENROUTER_BASE_URL: string;
  SESSION_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  USDA_API_KEY?: string;
  SENTRY_DSN?: string;
  R2_PUBLIC_URL: string;
  FRONTEND_URL: string;
  ENVIRONMENT: string;
  EMAIL_FROM?: string;
}

export interface AuthUser {
  id: string;
  email?: string;
  displayName?: string;
  authProvider: "anonymous" | "google" | "email";
  isGuest: boolean;
}

/* ----------------------------- Vision DTOs ----------------------------- */

export interface VisionFood {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  confidence?: number;
  source?: "ai" | "db" | "manual";
  foodId?: string;
}

export interface VisionResponse {
  foods: VisionFood[];
}

/* ----------------------------- Coach DTOs ------------------------------ */

export interface NutritionContext {
  weight?: number;
  goalWeight?: number;
  caloriesConsumed?: number;
  proteinConsumed?: number;
  calorieGoal?: number;
  proteinGoal?: number;
  waterMl?: number;
  waterGoalMl?: number;
  meals?: { type: string; name: string; calories: number; protein: number }[];
  weeklyTrend?: string;
  monthlyTrend?: string;
}

export interface CoachResponse {
  message: string;
}
