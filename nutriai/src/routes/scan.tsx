import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, Sparkles, Loader2, Trash2, Plus, Minus } from "lucide-react";
import { GlassCard, Button, Input, Segmented, Field } from "@/components/ui/primitives";
import { useApp } from "@/context/AppProvider";
import { useSaveMeal } from "@/hooks/data";
import { AIService, visionResultToItems } from "@/lib/ai";
import { blobToDataUrl, todayKey, uid, formatNumber } from "@/lib/utils";
import { MEAL_ORDER, MEAL_LABELS, type MealTypeValue, type FoodItem } from "@/lib/types";
import { useNavigate } from "@tanstack/react-router";

export function ScanPage() {
  const { settings } = useApp();
  const saveMeal = useSaveMeal();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<string | null>(null);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealTypeValue>("lunch");
  const [saved, setSaved] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const url = await blobToDataUrl(file);
    setImage(url);
    setItems([]);
    setAnalyzing(true);
    try {
      const result = await AIService.analyzeFoodImage(url);
      setItems(visionResultToItems(result));
    } catch (e: any) {
      setError(e.message ?? "Could not analyze image.");
    } finally {
      setAnalyzing(false);
    }
  };

  const updateItem = (id: string, patch: Partial<FoodItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  const save = () => {
    if (!items.length) return;
    const meal = {
      id: uid(),
      date: todayKey(),
      type: mealType,
      items,
      image: image ?? undefined,
      createdAt: Date.now(),
    };
    saveMeal.mutate(meal, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => {
          setImage(null);
          setItems([]);
          setSaved(false);
          navigate({ to: "/diary" });
        }, 1200);
      },
    });
  };

  const noKey = !settings?.openRouterKey;

  return (
    <div className="space-y-5">
      <header className="pt-2">
        <h1 className="text-2xl font-bold gradient-text">Scan Food</h1>
        <p className="text-sm text-white/50">Snap a meal, let AI do the math.</p>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        id="gallery"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {!image && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 py-10"
        >
          <button
            onClick={() => fileRef.current?.click()}
            className="relative flex h-44 w-44 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-cyan-400 shadow-[0_20px_70px_-15px_rgba(139,92,246,0.9)] animate-float-slow"
          >
            <Camera className="h-16 w-16 text-white" />
            <span className="absolute -bottom-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-violet-700">
              Take Photo
            </span>
          </button>
          <Button variant="glass" onClick={() => document.getElementById("gallery")?.click()}>
            <Upload className="h-4 w-4" /> Upload from gallery
          </Button>
          {noKey && (
            <p className="max-w-xs text-center text-xs text-amber-300/80">
              Add your OpenRouter API key in Settings to enable AI recognition.
            </p>
          )}
        </motion.div>
      )}

      <AnimatePresence>
        {image && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <GlassCard className="overflow-hidden !p-0">
              <img src={image} alt="meal preview" className="max-h-72 w-full object-cover" />
            </GlassCard>

            {analyzing && (
              <GlassCard className="flex items-center gap-3 text-sm text-white/70">
                <Loader2 className="h-5 w-5 animate-spin text-violet-300" />
                Analyzing your meal with AI…
              </GlassCard>
            )}

            {error && (
              <GlassCard className="border-red-400/30 text-sm text-red-200">
                {error}
                <div className="mt-3 flex gap-2">
                  <Button variant="glass" size="sm" onClick={() => fileRef.current?.click()}>
                    Retry
                  </Button>
                </div>
              </GlassCard>
            )}

            {!analyzing && !error && items.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-1">
                  <Sparkles className="h-4 w-4 text-violet-300" />
                  <span className="text-sm font-semibold">Detected Foods</span>
                </div>

                <div className="space-y-3">
                  {items.map((item) => (
                    <GlassCard key={item.id} className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <Field label="Food">
                          <Input
                            value={item.name}
                            onChange={(e) => updateItem(item.id, { name: e.target.value })}
                          />
                        </Field>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="mt-6 rounded-xl p-2 text-red-300 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Calories (kcal)">
                          <Input
                            type="number"
                            value={item.calories}
                            onChange={(e) => updateItem(item.id, { calories: +e.target.value })}
                          />
                        </Field>
                        <Field label="Protein (g)">
                          <Input
                            type="number"
                            value={item.protein}
                            onChange={(e) => updateItem(item.id, { protein: +e.target.value })}
                          />
                        </Field>
                        <Field label="Portion">
                          <Input
                            value={item.portion}
                            onChange={(e) => updateItem(item.id, { portion: e.target.value })}
                          />
                        </Field>
                        <Field label="Quantity">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}
                              className="glass-soft rounded-xl p-2"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-8 text-center font-semibold">{item.quantity}</span>
                            <button
                              onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })}
                              className="glass-soft rounded-xl p-2"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </Field>
                      </div>
                      {item.confidence != null && (
                        <div className="text-[11px] text-white/40">
                          AI confidence: {Math.round(item.confidence * 100)}%
                        </div>
                      )}
                    </GlassCard>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-sm font-medium text-white/60">Meal type</span>
                    <Segmented
                      value={mealType}
                      onChange={setMealType}
                      options={MEAL_ORDER.map((t) => ({ label: MEAL_LABELS[t], value: t }))}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm">
                    <span className="text-white/60">Total</span>
                    <span className="font-semibold">
                      {formatNumber(items.reduce((s, i) => s + i.calories * i.quantity, 0))} kcal ·{" "}
                      {formatNumber(items.reduce((s, i) => s + i.protein * i.quantity, 0))}g protein
                    </span>
                  </div>
                  <Button className="w-full" size="lg" onClick={save} loading={saveMeal.isPending}>
                    {saved ? "Saved ✓" : "Save Meal"}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
