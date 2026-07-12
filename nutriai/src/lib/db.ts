import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Meal, WeightLog, WaterLog, Goals, Settings } from "./types";
import { DEFAULT_GOALS, DEFAULT_SETTINGS } from "./types";

interface NutriDB extends DBSchema {
  meals: {
    key: string;
    value: Meal;
    indexes: { "by-date": string };
  };
  weight: {
    key: string;
    value: WeightLog;
    indexes: { "by-date": string };
  };
  water: {
    key: string;
    value: WaterLog;
    indexes: { "by-date": string };
  };
  favorites: {
    key: string;
    value: { id: string; name: string; calories: number; protein: number; carbs: number; fat: number; fiber: number; portion: string };
  };
  kv: {
    key: string;
    value: { key: string; value: unknown };
  };
  usage: {
    key: string;
    value: UsageRecord;
  };
}

export interface UsageRecord {
  date: string; // YYYY-MM-DD
  requests: number;
  promptTokens: number;
  completionTokens: number;
}

let dbPromise: Promise<IDBPDatabase<NutriDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<NutriDB>("nutriai", 2, {
      upgrade(db) {
        const meals = db.createObjectStore("meals", { keyPath: "id" });
        meals.createIndex("by-date", "date");

        const weight = db.createObjectStore("weight", { keyPath: "id" });
        weight.createIndex("by-date", "date");

        const water = db.createObjectStore("water", { keyPath: "id" });
        water.createIndex("by-date", "date");

        db.createObjectStore("favorites", { keyPath: "id" });
        db.createObjectStore("kv", { keyPath: "key" });
        if (!db.objectStoreNames.contains("usage")) {
          db.createObjectStore("usage", { keyPath: "date" });
        }
      },
    });
  }
  return dbPromise;
}

/* ----------------------------- Meals ----------------------------- */

export async function getAllMeals(): Promise<Meal[]> {
  const db = await getDB();
  const all = await db.getAll("meals");
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getMealsByDate(date: string): Promise<Meal[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("meals", "by-date", date);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function putMeal(meal: Meal): Promise<void> {
  const db = await getDB();
  await db.put("meals", meal);
}

export async function deleteMeal(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("meals", id);
}

/* ---------------------------- Weight ----------------------------- */

export async function getAllWeight(): Promise<WeightLog[]> {
  const db = await getDB();
  const all = await db.getAll("weight");
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function putWeight(log: WeightLog): Promise<void> {
  const db = await getDB();
  await db.put("weight", log);
}

export async function deleteWeight(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("weight", id);
}

/* ----------------------------- Water ----------------------------- */

export async function getWaterByDate(date: string): Promise<WaterLog[]> {
  const db = await getDB();
  return db.getAllFromIndex("water", "by-date", date);
}

export async function putWater(log: WaterLog): Promise<void> {
  const db = await getDB();
  await db.put("water", log);
}

export async function deleteWater(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("water", id);
}

/* --------------------------- Favorites --------------------------- */

export async function getFavorites() {
  const db = await getDB();
  return db.getAll("favorites");
}

export async function putFavorite(fav: {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  portion: string;
}) {
  const db = await getDB();
  await db.put("favorites", fav);
}

export async function deleteFavorite(id: string) {
  const db = await getDB();
  await db.delete("favorites", id);
}

/* ------------------------------- KV ------------------------------ */

async function getKV<T>(key: string, fallback: T): Promise<T> {
  const db = await getDB();
  const row = await db.get("kv", key);
  return row ? (row.value as T) : fallback;
}

async function setKV(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put("kv", { key, value });
}

export const getGoals = () => getKV<Goals>("goals", DEFAULT_GOALS);
export const setGoals = (g: Goals) => setKV("goals", g);

export const getSettings = () => getKV<Settings>("settings", DEFAULT_SETTINGS);
export const setSettings = (s: Settings) => setKV("settings", s);

/* ------------------------------ Usage ---------------------------------- */

export async function getUsage(date: string): Promise<UsageRecord> {
  const db = await getDB();
  const rec = await db.get("usage", date);
  return rec ?? { date, requests: 0, promptTokens: 0, completionTokens: 0 };
}

export async function addUsage(
  date: string,
  patch: Partial<Omit<UsageRecord, "date">>
): Promise<UsageRecord> {
  const db = await getDB();
  const current = await getUsage(date);
  const next: UsageRecord = {
    date,
    requests: current.requests + (patch.requests ?? 0),
    promptTokens: current.promptTokens + (patch.promptTokens ?? 0),
    completionTokens: current.completionTokens + (patch.completionTokens ?? 0),
  };
  await db.put("usage", next);
  return next;
}

/* --------------------------- Export/Import --------------------------- */

export interface Backup {
  version: 1;
  exportedAt: string;
  meals: Meal[];
  weight: WeightLog[];
  water: WaterLog[];
  favorites: Awaited<ReturnType<typeof getFavorites>>;
  goals: Goals;
  settings: Settings;
}

export async function exportData(): Promise<Backup> {
  const [meals, weight, favorites, goals, settings] = await Promise.all([
    getAllMeals(),
    getAllWeight(),
    getFavorites(),
    getGoals(),
    getSettings(),
  ]);
  const allWater = (await getDB()).getAll("water");
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    meals,
    weight,
    water: await allWater,
    favorites,
    goals,
    settings,
  };
}

export async function importData(data: Backup): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ["meals", "weight", "water", "favorites", "kv"],
    "readwrite"
  );
  await Promise.all([
    ...data.meals.map((m) => tx.objectStore("meals").put(m)),
    ...data.weight.map((w) => tx.objectStore("weight").put(w)),
    ...data.water.map((w) => tx.objectStore("water").put(w)),
    ...data.favorites.map((f) => tx.objectStore("favorites").put(f)),
    tx.objectStore("kv").put({ key: "goals", value: data.goals }),
    tx.objectStore("kv").put({ key: "settings", value: data.settings }),
  ]);
  await tx.done;
}
