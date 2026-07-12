import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Flame, Droplets, Dumbbell, Target, Sparkles, TrendingDown } from "lucide-react";
import { GlassCard, ProgressRing, StatCard, Skeleton } from "@/components/ui/primitives";
import { useApp } from "@/context/AppProvider";
import { useMealsByDate, useWaterByDate, useWeightHistory } from "@/hooks/data";
import { sumMeals, sumWater, round } from "@/lib/nutrition";
import { AIService } from "@/lib/ai";
import { greeting, todayKey, formatNumber, estimateBMI, estimateBodyFat } from "@/lib/utils";
import { MEAL_LABELS, MEAL_ORDER } from "@/lib/types";
import { Link } from "@tanstack/react-router";

export function HomePage() {
  const { goals } = useApp();
  const date = todayKey();
  const mealsQ = useMealsByDate(date);
  const waterQ = useWaterByDate(date);
  const weightQ = useWeightHistory();

  const totals = sumMeals(mealsQ.data ?? []);
  const waterMl = sumWater(waterQ.data ?? []);
  const caloriesRemaining = Math.max(0, (goals?.calorieGoal ?? 0) - totals.calories);
  const latestWeight = weightQ.data?.[weightQ.data.length - 1]?.weight;
  const bmi = latestWeight ? estimateBMI(latestWeight, goals?.heightCm ?? 0) : 0;

  const tipQ = useQuery({
    queryKey: ["coach", "daily", date],
    queryFn: async () => {
      const ctx = JSON.stringify({
        weight: latestWeight,
        goalWeight: goals?.weightGoal,
        caloriesConsumed: Math.round(totals.calories),
        proteinConsumed: Math.round(totals.protein),
        calorieGoal: goals?.calorieGoal,
        proteinGoal: goals?.proteinGoal,
        waterMl: Math.round(waterMl),
        waterGoalMl: goals?.waterGoalMl,
        meals: (mealsQ.data ?? []).flatMap((m) =>
          m.items.map((i) => ({ type: m.type, name: i.name, calories: i.calories, protein: i.protein }))
        ),
      });
      try {
        return await AIService.dailyCoach(ctx);
      } catch {
        return "Stay consistent — aim to hit your protein target and keep hydration up. Small daily wins compound into big results. 💪";
      }
    },
    enabled: !!goals,
  });

  const mealsByType = MEAL_ORDER.map((type) => ({
    type,
    meals: (mealsQ.data ?? []).filter((m) => m.type === type),
  }));

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between pt-2">
        <div>
          <p className="text-sm text-white/50">{greeting()}</p>
          <h1 className="text-3xl font-bold gradient-text">NutriAI</h1>
        </div>
        <span className="text-xs text-white/40">{date}</span>
      </header>

      {/* Calories hero */}
      <GlassCard glow className="flex items-center gap-5">
        <ProgressRing
          value={totals.calories}
          max={goals?.calorieGoal ?? 1}
          size={140}
          stroke={12}
          label={
            <div>
              <div className="text-2xl font-bold">{formatNumber(totals.calories)}</div>
              <div className="text-[11px] text-white/50">of {formatNumber(goals?.calorieGoal ?? 0)} kcal</div>
            </div>
          }
        />
        <div className="flex-1 space-y-3">
          <div>
            <div className="text-xs text-white/50">Remaining</div>
            <div className="text-2xl font-bold text-cyan-300">{formatNumber(caloriesRemaining)}</div>
            <div className="text-[11px] text-white/40">kcal today</div>
          </div>
          <div className="flex gap-2">
            <StatCard icon={<Flame className="h-3.5 w-3.5" />} label="Cal" value={formatNumber(totals.calories)} accent="#fb923c" />
          </div>
        </div>
      </GlassCard>

      {/* Protein + Water rings */}
      <div className="grid grid-cols-2 gap-4">
        <GlassCard className="flex flex-col items-center gap-2">
          <ProgressRing
            value={totals.protein}
            max={goals?.proteinGoal ?? 1}
            size={110}
            stroke={10}
            gradient={["#22d3ee", "#34d399"]}
            label={<span className="text-xl font-bold">{formatNumber(totals.protein)}g</span>}
            sublabel={`/ ${formatNumber(goals?.proteinGoal ?? 0)}g`}
          />
          <div className="flex items-center gap-1.5 text-xs text-white/60">
            <Dumbbell className="h-3.5 w-3.5 text-cyan-300" /> Protein
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col items-center gap-2">
          <ProgressRing
            value={waterMl}
            max={goals?.waterGoalMl ?? 1}
            size={110}
            stroke={10}
            gradient={["#38bdf8", "#818cf8"]}
            label={<span className="text-xl font-bold">{(waterMl / 1000).toFixed(1)}L</span>}
            sublabel={`/ ${((goals?.waterGoalMl ?? 0) / 1000).toFixed(1)}L`}
          />
          <div className="flex items-center gap-1.5 text-xs text-white/60">
            <Droplets className="h-3.5 w-3.5 text-sky-300" /> Water
          </div>
        </GlassCard>
      </div>

      {/* Weight goal */}
      {latestWeight && (
        <GlassCard className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
              <TrendingDown className="h-5 w-5 text-fuchsia-300" />
            </span>
            <div>
              <div className="text-xs text-white/50">Weight Goal</div>
              <div className="text-lg font-semibold">
                {round(latestWeight)} → {goals?.weightGoal} kg
              </div>
              <div className="text-[11px] text-white/40">
                BMI {round(bmi, 1)} · est. body fat {round(estimateBodyFat(bmi, goals?.age ?? 30, goals?.male ?? true))}%
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* AI Tip */}
      <GlassCard className="relative overflow-hidden">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-300" />
          <span className="text-sm font-semibold">AI Tip of the Day</span>
        </div>
        {tipQ.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-white/75">{tipQ.data}</p>
        )}
      </GlassCard>

      {/* Today's meals */}
      <div>
        <div className="mb-2 flex items-center gap-2 px-1">
          <Target className="h-4 w-4 text-white/50" />
          <span className="text-sm font-semibold text-white/70">Today's Meals</span>
        </div>
        {mealsQ.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (mealsQ.data ?? []).length === 0 ? (
          <GlassCard className="text-center text-sm text-white/50">
            No meals logged yet.{" "}
            <Link to="/scan" className="text-violet-300 underline">
              Scan your food
            </Link>{" "}
            to get started.
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {mealsByType
              .filter((g) => g.meals.length)
              .map((group) => (
                <div key={group.type}>
                  <div className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-white/40">
                    {MEAL_LABELS[group.type]}
                  </div>
                  {group.meals.map((meal) => {
                    const t = sumMeals([meal]);
                    return (
                      <motion.div
                        key={meal.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-soft mb-2 flex items-center gap-3 rounded-2xl p-3"
                      >
                        {meal.image ? (
                          <img src={meal.image} alt="" className="h-12 w-12 rounded-xl object-cover" />
                        ) : (
                          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-lg">
                            🍽️
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {meal.items.map((i) => i.name).join(", ")}
                          </div>
                          <div className="text-[11px] text-white/50">
                            {formatNumber(t.calories)} kcal · P {formatNumber(t.protein)} · C{" "}
                            {formatNumber(t.carbs)} · F {formatNumber(t.fat)}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
