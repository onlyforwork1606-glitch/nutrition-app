import type { Meal, WaterLog } from "./types";

export interface Totals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export function emptyTotals(): Totals {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
}

export function sumMeals(meals: Meal[]): Totals {
  return meals.reduce<Totals>((acc, meal) => {
    for (const it of meal.items) {
      acc.calories += it.calories * it.quantity;
      acc.protein += it.protein * it.quantity;
      acc.carbs += it.carbs * it.quantity;
      acc.fat += it.fat * it.quantity;
      acc.fiber += it.fiber * it.quantity;
    }
    return acc;
  }, emptyTotals());
}

export function sumWater(logs: WaterLog[]): number {
  return logs.reduce((s, w) => s + w.amount, 0);
}

export function round(n: number, d = 0): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
