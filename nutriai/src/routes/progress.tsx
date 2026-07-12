import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { GlassCard, Button, Input, Field, StatCard } from "@/components/ui/primitives";
import { useApp } from "@/context/AppProvider";
import {
  useAllMeals,
  useWeightHistory,
  useSaveWeight,
} from "@/hooks/data";
import { sumMeals, round } from "@/lib/nutrition";
import {
  todayKey,
  formatNumber,
  uid,
  estimateBMI,
  estimateBodyFat,
} from "@/lib/utils";
import { subDays, format } from "date-fns";
import { Scale, Target, TrendingUp } from "lucide-react";

const COLORS = ["#a78bfa", "#22d3ee", "#f472b6", "#34d399"];

export function ProgressPage() {
  const { goals } = useApp();
  const allMealsQ = useAllMeals();
  const weightQ = useWeightHistory();
  const saveWeight = useSaveWeight();

  const [weightInput, setWeightInput] = useState("");
  const [noteInput, setNoteInput] = useState("");

  const meals = allMealsQ.data ?? [];
  const weights = weightQ.data ?? [];

  const last7 = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      const key = format(d, "yyyy-MM-dd");
      const dayMeals = meals.filter((m) => m.date === key);
      return {
        label: format(d, "EEE"),
        calories: Math.round(sumMeals(dayMeals).calories),
        protein: Math.round(sumMeals(dayMeals).protein),
      };
    });
    return days;
  }, [meals]);

  const weightData = useMemo(
    () =>
      weights.map((w) => ({
        label: format(new Date(w.date + "T00:00:00"), "MMM d"),
        weight: round(w.weight, 1),
      })),
    [weights]
  );

  const todayTotals = sumMeals(meals.filter((m) => m.date === todayKey()));
  const macroData = [
    { name: "Protein", value: round(todayTotals.protein) },
    { name: "Carbs", value: round(todayTotals.carbs) },
    { name: "Fat", value: round(todayTotals.fat) },
    { name: "Fiber", value: round(todayTotals.fiber) },
  ].filter((m) => m.value > 0);

  const latestWeight = weights[weights.length - 1]?.weight;
  const bmi = latestWeight ? estimateBMI(latestWeight, goals?.heightCm ?? 0) : 0;

  const predictedDate = useMemo(() => {
    if (weights.length < 2 || !goals) return null;
    const sorted = [...weights].sort((a, b) => a.createdAt - b.createdAt);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const days = (last.createdAt - first.createdAt) / 86400000;
    if (days < 1) return null;
    const rate = (last.weight - first.weight) / days; // kg/day
    if (rate >= 0) return null;
    const remain = last.weight - goals.weightGoal;
    const daysToGoal = Math.ceil(remain / -rate);
    return format(new Date(Date.now() + daysToGoal * 86400000), "MMM d, yyyy");
  }, [weights, goals]);

  const onLogWeight = () => {
    if (!weightInput) return;
    saveWeight.mutate(
      {
        id: uid(),
        date: todayKey(),
        weight: +weightInput,
        note: noteInput || undefined,
        createdAt: Date.now(),
      },
      { onSuccess: () => { setWeightInput(""); setNoteInput(""); } }
    );
  };

  const avgProtein =
    last7.reduce((s, d) => s + d.protein, 0) / (last7.filter((d) => d.protein > 0).length || 1);

  const weekCalories = last7.reduce((s, d) => s + d.calories, 0);
  const goalCompletion = goals
    ? Math.min(100, Math.round((weekCalories / (goals.calorieGoal * 7)) * 100))
    : 0;

  return (
    <div className="space-y-5">
      <header className="pt-2">
        <h1 className="text-2xl font-bold gradient-text">Progress</h1>
        <p className="text-sm text-white/50">Trends, weight & goals.</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Avg Protein" value={formatNumber(round(avgProtein))} unit="g" accent="#22d3ee" />
        <StatCard icon={<Target className="h-3.5 w-3.5" />} label="Goal Hit" value={goalCompletion} unit="%" accent="#a78bfa" />
      </div>

      {/* Weekly calories */}
      <GlassCard>
        <div className="mb-2 text-sm font-semibold">Weekly Calories</div>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={last7}>
            <defs>
              <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: "rgba(20,20,30,0.9)", border: "none", borderRadius: 12, color: "#fff" }}
              formatter={(v: number) => [`${v} kcal`, "Calories"]}
            />
            <Bar dataKey="calories" fill="url(#bar)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </GlassCard>

      {/* Protein trend */}
      <GlassCard>
        <div className="mb-2 text-sm font-semibold">Protein Trend</div>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={last7}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ background: "rgba(20,20,30,0.9)", border: "none", borderRadius: 12, color: "#fff" }} />
            <Line type="monotone" dataKey="protein" stroke="#22d3ee" strokeWidth={3} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </GlassCard>

      {/* Macro pie */}
      <GlassCard>
        <div className="mb-2 text-sm font-semibold">Today's Macros</div>
        {macroData.length ? (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={160}>
              <PieChart>
                <Pie data={macroData} dataKey="value" innerRadius={40} outerRadius={70} paddingAngle={3}>
                  {macroData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "rgba(20,20,30,0.9)", border: "none", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {macroData.map((m, i) => (
                <div key={m.name} className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-white/70">{m.name}</span>
                  <span className="ml-auto font-medium">{m.value}g</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-white/40">No data logged today.</p>
        )}
      </GlassCard>

      {/* Weight tracker */}
      <GlassCard>
        <div className="mb-3 flex items-center gap-2">
          <Scale className="h-5 w-5 text-fuchsia-300" />
          <span className="text-sm font-semibold">Weight Tracker</span>
        </div>

        {latestWeight && (
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-white/5 p-3">
              <div className="text-lg font-bold">{round(latestWeight)}</div>
              <div className="text-[11px] text-white/50">kg</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <div className="text-lg font-bold">{round(bmi, 1)}</div>
              <div className="text-[11px] text-white/50">BMI</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <div className="text-lg font-bold">{round(estimateBodyFat(bmi, goals?.age ?? 30, goals?.male ?? true))}%</div>
              <div className="text-[11px] text-white/50">Body fat</div>
            </div>
          </div>
        )}

        {predictedDate && (
          <div className="mb-3 rounded-2xl bg-linear-to-r from-violet-500/20 to-cyan-400/20 p-3 text-sm">
            🎯 Predicted goal date: <span className="font-semibold">{predictedDate}</span>
          </div>
        )}

        {weightData.length > 1 && (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={weightData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
              <Tooltip contentStyle={{ background: "rgba(20,20,30,0.9)", border: "none", borderRadius: 12, color: "#fff" }} />
              <Line type="monotone" dataKey="weight" stroke="#f472b6" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}

        <div className="mt-3 space-y-2">
          <Field label="Log weight (kg)">
            <Input type="number" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} placeholder="e.g. 84.5" />
          </Field>
          <Input value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="Note (optional)" />
          <Button className="w-full" onClick={onLogWeight} loading={saveWeight.isPending}>
            Log Weight
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
