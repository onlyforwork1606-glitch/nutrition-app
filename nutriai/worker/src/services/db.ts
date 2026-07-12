import type { Env, NutritionContext } from "../types";

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
