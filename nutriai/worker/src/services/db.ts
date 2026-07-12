import type { Env, NutritionContext } from "../types";

/**
 * Idempotent D1 schema. Mirrors migrations/0001_init.sql so the database
 * self-initializes on first request — no separate migration step is required
 * at deploy time. Safe to run on every cold start (CREATE TABLE IF NOT EXISTS).
 */
const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE,
  google_id     TEXT UNIQUE,
  display_name  TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'anonymous',
  is_guest      INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  deleted_at    INTEGER
);

CREATE TABLE IF NOT EXISTS goals (
  user_id         TEXT PRIMARY KEY,
  calorie_goal    REAL NOT NULL DEFAULT 2200,
  protein_goal    REAL NOT NULL DEFAULT 140,
  carbs_goal      REAL NOT NULL DEFAULT 220,
  fat_goal        REAL NOT NULL DEFAULT 70,
  fiber_goal      REAL NOT NULL DEFAULT 30,
  weight_goal     REAL NOT NULL DEFAULT 80,
  height_cm       REAL NOT NULL DEFAULT 172,
  age             INTEGER NOT NULL DEFAULT 28,
  male            INTEGER NOT NULL DEFAULT 1,
  water_goal_ml   REAL NOT NULL DEFAULT 2500,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  deleted_at      INTEGER
);

CREATE TABLE IF NOT EXISTS meals (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  date        TEXT NOT NULL,
  type        TEXT NOT NULL,
  note        TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_meals_user_date ON meals(user_id, date);
CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);

CREATE TABLE IF NOT EXISTS meal_items (
  id           TEXT PRIMARY KEY,
  meal_id      TEXT NOT NULL,
  food_id      TEXT,
  name         TEXT NOT NULL,
  portion      TEXT,
  quantity     REAL NOT NULL DEFAULT 1,
  calories     REAL NOT NULL DEFAULT 0,
  protein      REAL NOT NULL DEFAULT 0,
  carbs        REAL NOT NULL DEFAULT 0,
  fat          REAL NOT NULL DEFAULT 0,
  fiber        REAL NOT NULL DEFAULT 0,
  confidence   REAL,
  source       TEXT NOT NULL DEFAULT 'ai',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  deleted_at   INTEGER,
  FOREIGN KEY (meal_id) REFERENCES meals(id)
);
CREATE INDEX IF NOT EXISTS idx_meal_items_meal ON meal_items(meal_id);

CREATE TABLE IF NOT EXISTS meal_images (
  id          TEXT PRIMARY KEY,
  meal_id     TEXT NOT NULL,
  r2_key      TEXT NOT NULL,
  url         TEXT,
  is_temp     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  FOREIGN KEY (meal_id) REFERENCES meals(id)
);
CREATE INDEX IF NOT EXISTS idx_meal_images_meal ON meal_images(meal_id);

CREATE TABLE IF NOT EXISTS daily_summary (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  date          TEXT NOT NULL,
  calories      REAL NOT NULL DEFAULT 0,
  protein       REAL NOT NULL DEFAULT 0,
  carbs         REAL NOT NULL DEFAULT 0,
  fat           REAL NOT NULL DEFAULT 0,
  fiber         REAL NOT NULL DEFAULT 0,
  water_ml      REAL NOT NULL DEFAULT 0,
  consistency   REAL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  deleted_at    INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_user_date ON daily_summary(user_id, date);

CREATE TABLE IF NOT EXISTS weight_logs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  date        TEXT NOT NULL,
  weight      REAL NOT NULL,
  note        TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_weight_user_date ON weight_logs(user_id, date);

CREATE TABLE IF NOT EXISTS water_logs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  date        TEXT NOT NULL,
  amount      REAL NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_water_user_date ON water_logs(user_id, date);

CREATE TABLE IF NOT EXISTS exercise_logs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  date        TEXT NOT NULL,
  activity    TEXT NOT NULL,
  duration_min REAL,
  calories_burned REAL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_exercise_user_date ON exercise_logs(user_id, date);

CREATE TABLE IF NOT EXISTS coach_messages (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_coach_user ON coach_messages(user_id, created_at);

CREATE TABLE IF NOT EXISTS favorites (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  portion     TEXT,
  calories    REAL NOT NULL DEFAULT 0,
  protein     REAL NOT NULL DEFAULT 0,
  carbs       REAL NOT NULL DEFAULT 0,
  fat         REAL NOT NULL DEFAULT 0,
  fiber       REAL NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS food_db (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  aliases         TEXT,
  portion         TEXT,
  calories        REAL NOT NULL,
  protein         REAL NOT NULL,
  carbs           REAL NOT NULL,
  fat             REAL NOT NULL,
  fiber           REAL NOT NULL,
  source          TEXT NOT NULL DEFAULT 'curated',
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_food_db_name ON food_db(name);

CREATE TABLE IF NOT EXISTS settings (
  user_id         TEXT PRIMARY KEY,
  units           TEXT NOT NULL DEFAULT 'metric',
  reduce_motion   INTEGER NOT NULL DEFAULT 0,
  notifications   INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  deleted_at      INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS migration_history (
  version         TEXT PRIMARY KEY,
  applied_at      INTEGER NOT NULL,
  description     TEXT
);
`;

let schemaPromise: Promise<void> | null = null;

/** Ensure the D1 schema exists. Runs once per isolate and is cached. */
export function ensureSchema(env: Env): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = initSchema(env.DB).catch((e) => {
      schemaPromise = null;
      throw e;
    });
  }
  return schemaPromise;
}

async function initSchema(db: D1Database): Promise<void> {
  await db.prepare("PRAGMA foreign_keys = ON").run();
  const statements = SCHEMA_SQL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.toUpperCase().startsWith("PRAGMA"))
    .map((s) => db.prepare(s));
  await db.batch(statements as any);
}

export class Repo {
  constructor(private env: Env) {}

  async getUserSettings(userId: string) {
    return this.env.DB.prepare("SELECT * FROM settings WHERE user_id = ?")
      .bind(userId)
      .first<any>();
  }

  async getGoals(userId: string) {
    return this.env.DB.prepare("SELECT * FROM goals WHERE user_id = ? AND deleted_at IS NULL")
      .bind(userId)
      .first<any>();
  }

  async createGoals(userId: string, g: Record<string, number>) {
    const now = Date.now();
    return this.env.DB.prepare(
      `INSERT OR REPLACE INTO goals
       (user_id, calorie_goal, protein_goal, carbs_goal, fat_goal, fiber_goal,
        weight_goal, height_cm, age, male, water_goal_ml, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
      .bind(
        userId,
        g.calorie_goal ?? 2200,
        g.protein_goal ?? 140,
        g.carbs_goal ?? 220,
        g.fat_goal ?? 70,
        g.fiber_goal ?? 30,
        g.weight_goal ?? 80,
        g.height_cm ?? 172,
        g.age ?? 28,
        g.male ?? 1,
        g.water_goal_ml ?? 2500,
        now,
        now
      )
      .run();
  }

  async saveMeal(userId: string, meal: any) {
    const now = Date.now();
    await this.env.DB.prepare(
      `INSERT OR REPLACE INTO meals (id, user_id, date, type, note, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?)`
    )
      .bind(meal.id, userId, meal.date, meal.type, meal.note ?? "", now, now)
      .run();
    if (meal.items?.length) {
      const stmts = meal.items.map((it: any) =>
        this.env.DB.prepare(
          `INSERT OR IGNORE INTO meal_items
           (id, meal_id, food_id, name, portion, quantity, calories, protein, carbs, fat, fiber, confidence, source, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(
          it.id ?? crypto.randomUUID(),
          meal.id,
          it.foodId ?? null,
          it.name,
          it.portion ?? "",
          it.quantity ?? 1,
          it.calories ?? 0,
          it.protein ?? 0,
          it.carbs ?? 0,
          it.fat ?? 0,
          it.fiber ?? 0,
          it.confidence ?? null,
          it.source ?? "ai",
          now,
          now
        )
      );
      await this.env.DB.batch(stmts);
    }
  }

  async getMeals(userId: string, date: string) {
    const meals = await this.env.DB.prepare(
      "SELECT * FROM meals WHERE user_id = ? AND date = ? AND deleted_at IS NULL"
    )
      .bind(userId, date)
      .all<any>();
    for (const m of meals.results ?? []) {
      const items = await this.env.DB.prepare(
        "SELECT * FROM meal_items WHERE meal_id = ? AND deleted_at IS NULL"
      )
        .bind(m.id)
        .all<any>();
      m.items = items.results ?? [];
    }
    return meals.results ?? [];
  }

  async logWeight(userId: string, date: string, weight: number) {
    const now = Date.now();
    const id = crypto.randomUUID();
    return this.env.DB.prepare(
      `INSERT INTO weight_logs (id, user_id, date, weight, created_at, updated_at)
       VALUES (?,?,?,?,?,?)`
    )
      .bind(id, userId, date, weight, now, now)
      .run();
  }

  async logWater(userId: string, date: string, amount: number) {
    const now = Date.now();
    const id = crypto.randomUUID();
    return this.env.DB.prepare(
      `INSERT INTO water_logs (id, user_id, date, amount, created_at, updated_at)
       VALUES (?,?,?,?,?,?)`
    )
      .bind(id, userId, date, amount, now, now)
      .run();
  }

  async logExercise(userId: string, e: any) {
    const now = Date.now();
    const id = crypto.randomUUID();
    return this.env.DB.prepare(
      `INSERT INTO exercise_logs (id, user_id, date, activity, duration_min, calories_burned, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`
    )
      .bind(id, userId, e.date, e.activity, e.duration_min ?? null, e.calories_burned ?? null, now, now)
      .run();
  }

  async getProgress(userId: string) {
    const weight = await this.env.DB.prepare(
      "SELECT * FROM weight_logs WHERE user_id = ? AND deleted_at IS NULL ORDER BY date DESC LIMIT 30"
    )
      .bind(userId)
      .all<any>();
    const water = await this.env.DB.prepare(
      "SELECT * FROM water_logs WHERE user_id = ? AND deleted_at IS NULL ORDER BY date DESC LIMIT 30"
    )
      .bind(userId)
      .all<any>();
    const exercise = await this.env.DB.prepare(
      "SELECT * FROM exercise_logs WHERE user_id = ? AND deleted_at IS NULL ORDER BY date DESC LIMIT 30"
    )
      .bind(userId)
      .all<any>();
    return {
      weight: weight.results ?? [],
      water: water.results ?? [],
      exercise: exercise.results ?? [],
    };
  }

  async addCoachMessage(userId: string, role: string, content: string) {
    const now = Date.now();
    const id = crypto.randomUUID();
    return this.env.DB.prepare(
      "INSERT INTO coach_messages (id, user_id, role, content, created_at) VALUES (?,?,?,?,?)"
    )
      .bind(id, userId, role, content, now)
      .run();
  }

  async getCoachHistory(userId: string, limit = 30) {
    const res = await this.env.DB.prepare(
      "SELECT * FROM coach_messages WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ?"
    )
      .bind(userId, limit)
      .all<any>();
    return (res.results ?? []).reverse();
  }

  /** Build the nutrition context the coach reasons over. */
  async buildContext(userId: string, date: string): Promise<NutritionContext> {
    const goals = await this.getGoals(userId);
    const meals = await this.getMeals(userId, date);
    let calories = 0;
    let protein = 0;
    const flat: NutritionContext["meals"] = [];
    for (const m of meals) {
      for (const it of m.items ?? []) {
        calories += it.calories ?? 0;
        protein += it.protein ?? 0;
        flat.push({ type: m.type, name: it.name, calories: it.calories, protein: it.protein });
      }
    }
    const water = await this.env.DB.prepare(
      "SELECT COALESCE(SUM(amount),0) s FROM water_logs WHERE user_id = ? AND date = ?"
    )
      .bind(userId, date)
      .first<any>();
    const lastWeight = await this.env.DB.prepare(
      "SELECT weight FROM weight_logs WHERE user_id = ? AND deleted_at IS NULL ORDER BY date DESC LIMIT 1"
    )
      .bind(userId)
      .first<any>();
    return {
      weight: lastWeight?.weight,
      goalWeight: goals?.weight_goal,
      caloriesConsumed: Math.round(calories),
      proteinConsumed: Math.round(protein),
      calorieGoal: goals?.calorie_goal,
      proteinGoal: goals?.protein_goal,
      waterMl: water?.s ?? 0,
      waterGoalMl: goals?.water_goal_ml,
      meals: flat,
    };
  }
}
