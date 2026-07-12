import { z } from "zod";

export const MealType = {
  Breakfast: "breakfast",
  Lunch: "lunch",
  Snacks: "snacks",
  Dinner: "dinner",
} as const;

export type MealTypeValue = (typeof MealType)[keyof typeof MealType];

export const MEAL_ORDER: MealTypeValue[] = [
  MealType.Breakfast,
  MealType.Lunch,
  MealType.Snacks,
  MealType.Dinner,
];

export const MEAL_LABELS: Record<MealTypeValue, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snacks: "Snacks",
  dinner: "Dinner",
};

/** A single detected / logged food item. */
export const FoodItemSchema = z.object({
  id: z.string().default(""),
  name: z.string().min(1, "Name is required"),
  portion: z.string().default(""),
  quantity: z.number().min(0).default(1),
  calories: z.number().min(0).default(0),
  protein: z.number().min(0).default(0),
  carbs: z.number().min(0).default(0),
  fat: z.number().min(0).default(0),
  fiber: z.number().min(0).default(0),
  confidence: z.number().min(0).max(1).optional(),
  source: z.enum(["ifct", "usda", "curated", "ai", "manual"]).optional(),
  foodId: z.string().optional(),
  needsConfirmation: z.boolean().optional(),
});

export type FoodItem = z.infer<typeof FoodItemSchema>;

/** A meal groups food items under a meal type for a given day. */
export interface Meal {
  id: string;
  date: string; // YYYY-MM-DD
  type: MealTypeValue;
  items: FoodItem[];
  image?: string; // data URL
  note?: string;
  createdAt: number;
}

export interface WeightLog {
  id: string;
  date: string;
  weight: number; // kg
  note?: string;
  createdAt: number;
}

export interface WaterLog {
  id: string;
  date: string;
  amount: number; // ml
  createdAt: number;
}

export interface Goals {
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  fiberGoal: number;
  weightGoal: number;
  heightCm: number;
  age: number;
  male: boolean;
  waterGoalMl: number;
}

export interface Settings {
  openRouterKey: string;
  units: "metric" | "imperial";
  reduceMotion: boolean;
  notifications: boolean;
}

/** What the vision pipeline returns. */
export const VisionResultSchema = z.object({
  foods: z.array(
    z.object({
      name: z.string(),
      portion: z.string().default(""),
      calories: z.number().min(0),
      protein: z.number().min(0).default(0),
      fat: z.number().min(0).default(0),
      carbs: z.number().min(0).default(0),
      fiber: z.number().min(0).default(0),
      confidence: z.number().min(0).max(1).optional(),
      source: z.enum(["ifct", "usda", "curated", "ai"]).optional(),
      foodId: z.string().optional(),
      needsConfirmation: z.boolean().optional(),
    })
  ),
  confirmThreshold: z.number().optional(),
});

export type VisionResult = z.infer<typeof VisionResultSchema>;

export const DEFAULT_GOALS: Goals = {
  calorieGoal: 2200,
  proteinGoal: 140,
  carbsGoal: 220,
  fatGoal: 70,
  fiberGoal: 30,
  weightGoal: 80,
  heightCm: 172,
  age: 28,
  male: true,
  waterGoalMl: 2500,
};

export const DEFAULT_SETTINGS: Settings = {
  openRouterKey: "",
  units: "metric",
  reduceMotion: false,
  notifications: false,
};
