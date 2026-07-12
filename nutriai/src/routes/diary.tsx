import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
  Droplets,
  Plus,
  Flame,
  Camera,
} from "lucide-react";
import { GlassCard, Button, Input, Segmented, Field } from "@/components/ui/primitives";
import { useApp } from "@/context/AppProvider";
import {
  useMealsByDate,
  useDeleteMeal,
  useWaterByDate,
  useAddWater,
  useDeleteWaterLog,
  useSaveMeal,
} from "@/hooks/data";
import {
  sumMeals,
  sumWater,
  round,
} from "@/lib/nutrition";
import {
  todayKey,
  formatNumber,
  uid,
} from "@/lib/utils";
import {
  MEAL_ORDER,
  MEAL_LABELS,
  type MealTypeValue,
  type Meal,
  type FoodItem,
} from "@/lib/types";
import { useNavigate } from "@tanstack/react-router";
import { addDays, format } from "date-fns";

const WATER_PRESETS = [250, 500, 1000];

export function DiaryPage() {
  const navigate = useNavigate();
  const { goals } = useApp();
  const [date, setDate] = useState(todayKey());
  const mealsQ = useMealsByDate(date);
  const waterQ = useWaterByDate(date);
  const deleteMeal = useDeleteMeal();
  const addWater = useAddWater();
  const deleteWater = useDeleteWaterLog();
  const saveMeal = useSaveMeal();

  const [editing, setEditing] = useState<Meal | null>(null);
  const [quickAdd, setQuickAdd] = useState(false);
  const [qa, setQa] = useState({
    name: "",
    calories: "",
    protein: "",
    type: "snacks" as MealTypeValue,
  });

  const waterMl = sumWater(waterQ.data ?? []);
  const totals = sumMeals(mealsQ.data ?? []);
  const d = new Date(date + "T00:00:00");

  const onAddWater = (amt: number) =>
    addWater.mutate({ id: uid(), date, amount: amt, createdAt: Date.now() });

  const onQuickAdd = () => {
    if (!qa.name.trim() || !qa.calories) return;
    const item: FoodItem = {
      id: uid(),
      name: qa.name,
      portion: "",
      quantity: 1,
      calories: +qa.calories,
      protein: +(qa.protein || 0),
      carbs: 0,
      fat: 0,
      fiber: 0,
    };
    const meal: Meal = {
      id: uid(),
      date,
      type: qa.type,
      items: [item],
      createdAt: Date.now(),
    };
    saveMeal.mutate(meal, {
      onSuccess: () => {
        setQuickAdd(false);
        setQa({ name: "", calories: "", protein: "", type: "snacks" });
      },
    });
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold gradient-text">Diary</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDate(format(addDays(d, -1), "yyyy-MM-dd"))}
            className="glass-soft rounded-xl p-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[88px] text-center text-sm font-medium">
            {format(d, "MMM d")}
          </span>
          <button
            onClick={() => setDate(format(addDays(d, 1), "yyyy-MM-dd"))}
            className="glass-soft rounded-xl p-2"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Daily totals */}
      <GlassCard className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-300" />
          <div>
            <div className="text-lg font-bold">{formatNumber(totals.calories)}</div>
            <div className="text-[11px] text-white/50">kcal consumed</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-cyan-300">{formatNumber(totals.protein)}g</div>
          <div className="text-[11px] text-white/50">protein</div>
        </div>
      </GlassCard>

      {/* Water tracker */}
      <GlassCard>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-sky-300" />
            <span className="text-sm font-semibold">Water</span>
          </div>
          <span className="text-sm text-white/60">
            {(waterMl / 1000).toFixed(2)} / {((goals?.waterGoalMl ?? 0) / 1000).toFixed(1)} L
          </span>
        </div>
        <div className="mb-3 h-3 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-linear-to-r from-sky-400 to-indigo-400"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (waterMl / (goals?.waterGoalMl || 1)) * 100)}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
        <div className="flex gap-2">
          {WATER_PRESETS.map((amt) => (
            <Button key={amt} variant="glass" size="sm" onClick={() => onAddWater(amt)}>
              +{amt >= 1000 ? "1L" : `${amt}ml`}
            </Button>
          ))}
          {(waterQ.data ?? []).length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (waterQ.data ?? []).forEach((w) => deleteWater.mutate(w))}
            >
              Reset
            </Button>
          )}
        </div>
      </GlassCard>

      {/* Quick add */}
      <div className="flex gap-2">
        <Button variant="glass" className="flex-1" size="sm" onClick={() => navigate({ to: "/scan" })}>
          <Camera className="h-4 w-4" /> Scan
        </Button>
        <Button variant="glass" className="flex-1" size="sm" onClick={() => setQuickAdd((v) => !v)}>
          <Plus className="h-4 w-4" /> Add food
        </Button>
      </div>

      <AnimatePresence>
        {quickAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <GlassCard className="space-y-3">
              <Field label="Food name">
                <Input value={qa.name} onChange={(e) => setQa({ ...qa, name: e.target.value })} placeholder="e.g. Greek yogurt" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Calories">
                  <Input type="number" value={qa.calories} onChange={(e) => setQa({ ...qa, calories: e.target.value })} />
                </Field>
                <Field label="Protein (g)">
                  <Input type="number" value={qa.protein} onChange={(e) => setQa({ ...qa, protein: e.target.value })} />
                </Field>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Meal</span>
                <Segmented
                  value={qa.type}
                  onChange={(v) => setQa({ ...qa, type: v })}
                  options={MEAL_ORDER.map((t) => ({ label: MEAL_LABELS[t], value: t }))}
                />
              </div>
              <Button className="w-full" onClick={onQuickAdd} loading={saveMeal.isPending}>
                Add to diary
              </Button>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Meals by type */}
      <div className="space-y-5">
        {MEAL_ORDER.map((type) => {
          const meals = (mealsQ.data ?? []).filter((m) => m.type === type);
          return (
            <div key={type}>
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-white/70">{MEAL_LABELS[type]}</h2>
                <span className="text-xs text-white/40">
                  {formatNumber(round(sumMeals(meals).calories))} kcal
                </span>
              </div>
              {meals.length === 0 ? (
                <div className="glass-soft rounded-2xl p-4 text-center text-xs text-white/40">
                  Nothing logged
                </div>
              ) : (
                meals.map((meal) => {
                  const t = sumMeals([meal]);
                  return (
                    <motion.div
                      key={meal.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="glass-soft mb-2 flex items-center gap-3 rounded-2xl p-3"
                    >
                      {meal.image ? (
                        <img src={meal.image} alt="" className="h-14 w-14 rounded-xl object-cover" />
                      ) : (
                        <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-xl">
                          🍽️
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {meal.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                        </div>
                        <div className="text-[11px] text-white/50">
                          {formatNumber(t.calories)} kcal · P {formatNumber(t.protein)} · C{" "}
                          {formatNumber(t.carbs)} · F {formatNumber(t.fat)}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button onClick={() => setEditing(meal)} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteMeal.mutate(meal)}
                          className="rounded-lg p-1.5 text-red-300 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      {/* Edit modal */}
      <AnimatePresence>
        {editing && (
          <EditMealModal
            meal={editing}
            onClose={() => setEditing(null)}
            onSave={(updated) => {
              saveMeal.mutate(updated, { onSuccess: () => setEditing(null) });
            }}
            onDelete={(m) => {
              deleteMeal.mutate(m, { onSuccess: () => setEditing(null) });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EditMealModal({
  meal,
  onClose,
  onSave,
  onDelete,
}: {
  meal: Meal;
  onClose: () => void;
  onSave: (m: Meal) => void;
  onDelete: (m: Meal) => void;
}) {
  const [items, setItems] = useState<FoodItem[]>(meal.items);

  const update = (id: string, patch: Partial<FoodItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md p-3"
      >
        <GlassCard className="max-h-[80vh] space-y-3 overflow-y-auto !rounded-[2rem]">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Edit {MEAL_LABELS[meal.type]}</h3>
            <button onClick={onClose} className="text-white/60">✕</button>
          </div>
          {items.map((item) => (
            <div key={item.id} className="space-y-2 rounded-2xl bg-white/5 p-3">
              <Input value={item.name} onChange={(e) => update(item.id, { name: e.target.value })} />
              <div className="grid grid-cols-3 gap-2">
                <Field label="kcal">
                  <Input type="number" value={item.calories} onChange={(e) => update(item.id, { calories: +e.target.value })} />
                </Field>
                <Field label="Protein">
                  <Input type="number" value={item.protein} onChange={(e) => update(item.id, { protein: +e.target.value })} />
                </Field>
                <Field label="Carbs">
                  <Input type="number" value={item.carbs} onChange={(e) => update(item.id, { carbs: +e.target.value })} />
                </Field>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => onDelete(meal)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
            <Button
              className="flex-1"
              onClick={() => onSave({ ...meal, items })}
            >
              Save
            </Button>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
