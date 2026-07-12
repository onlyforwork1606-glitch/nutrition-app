import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send } from "lucide-react";
import { GlassCard, Input, Button } from "@/components/ui/primitives";
import { useApp } from "@/context/AppProvider";
import {
  useMealsByDate,
  useWaterByDate,
  useWeightHistory,
} from "@/hooks/data";
import { AIService } from "@/lib/ai";
import { todayKey, cn } from "@/lib/utils";
import type { Meal } from "@/lib/types";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "How much protein do I still need?",
  "What should I eat tonight?",
  "I'm craving sweets — help!",
  "Suggest high protein vegetarian meals",
];

function buildContext(
  meals: Meal[] | undefined,
  waterMl: number,
  goals: any,
  weight: number | undefined
) {
  const items = (meals ?? []).flatMap((m) =>
    m.items.map((i) => ({
      type: m.type,
      name: i.name,
      calories: i.calories,
      protein: i.protein,
    }))
  );
  const calories = items.reduce((s, i) => s + i.calories, 0);
  const protein = items.reduce((s, i) => s + i.protein, 0);
  return {
    weight,
    goalWeight: goals?.weightGoal,
    caloriesConsumed: Math.round(calories),
    proteinConsumed: Math.round(protein),
    calorieGoal: goals?.calorieGoal,
    proteinGoal: goals?.proteinGoal,
    waterMl: Math.round(waterMl),
    waterGoalMl: goals?.waterGoalMl,
    meals: items,
  };
}

export function AICoach() {
  const { goals, hasKey } = useApp();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const date = todayKey();
  const mealsQ = useMealsByDate(date);
  const waterQ = useWaterByDate(date);
  const weightQ = useWeightHistory();
  const waterMl =
    (waterQ.data ?? []).reduce((s, w) => s + w.amount, 0) ?? 0;
  const weight = weightQ.data?.[weightQ.data.length - 1]?.weight;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" });
  }, [msgs, open]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    if (!hasKey) {
      setMsgs((m) => [
        ...m,
        { role: "user", content: text },
        {
          role: "assistant",
          content:
            "The AI coach is managed by the NutriAI server. It looks like the server is offline or not configured — please try again later. ✨",
        },
      ]);
      setInput("");
      return;
    }
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setBusy(true);
    try {
      const ctx = JSON.stringify(
        buildContext(mealsQ.data, waterMl, goals, weight)
      );
      const reply = await AIService.chat(text, ctx, history);
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e: any) {
      setMsgs((m) => [
        ...m,
        { role: "assistant", content: `⚠️ ${e.message ?? "Request failed"}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-cyan-400 shadow-[0_10px_40px_-8px_rgba(139,92,246,0.8)]"
        aria-label="Open AI Coach"
      >
        <Sparkles className="h-6 w-6 text-white" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md p-3"
            >
              <GlassCard className="flex h-[70vh] flex-col !rounded-[2rem]">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-cyan-400">
                      <Sparkles className="h-5 w-5 text-white" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold">NutriAI Coach</div>
                      <div className="text-[11px] text-white/50">
                        Your personal nutrition guide
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setOpen(false)} className="text-white/60">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div
                  ref={scrollRef}
                  className="no-scrollbar flex-1 space-y-3 overflow-y-auto py-4"
                >
                  {msgs.length === 0 && (
                    <div className="space-y-3">
                      <p className="text-sm text-white/60">
                        Hi! I'm your AI coach. Ask me anything about your
                        nutrition, or tap a suggestion:
                      </p>
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => send(s)}
                          className="glass-soft block w-full rounded-2xl px-4 py-2.5 text-left text-sm text-white/80 hover:bg-white/10"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {msgs.map((m, i) => (
                    <div
                      key={i}
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                        m.role === "user"
                          ? "ml-auto bg-violet-500/30 text-white"
                          : "mr-auto glass-soft text-white/90"
                      )}
                    >
                      {m.content}
                    </div>
                  ))}
                  {busy && (
                    <div className="mr-auto glass-soft rounded-2xl px-4 py-3 text-sm text-white/60">
                      Thinking…
                    </div>
                  )}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(input);
                  }}
                  className="flex gap-2 pt-2"
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask your coach…"
                    className="!py-2.5"
                  />
                  <Button type="submit" size="sm" loading={busy} className="!px-4">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
