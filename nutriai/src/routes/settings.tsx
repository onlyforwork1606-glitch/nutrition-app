import { useState } from "react";
import { KeyRound, Download, Upload, Palette, Bell, Gauge, RefreshCw } from "lucide-react";
import { GlassCard, Button, Input, Field, Segmented } from "@/components/ui/primitives";
import { useApp } from "@/context/AppProvider";
import { exportData, importData, type Backup } from "@/lib/db";
import { apiClient } from "@/lib/api";

export function SettingsPage() {
  const { goals, settings, updateGoals, updateSettings } = useApp();
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const onExport = async () => {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nutriai-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Backup;
      await importData(data);
      setImportMsg("Imported successfully. Reloading…");
      setTimeout(() => location.reload(), 1000);
    } catch {
      setImportMsg("Invalid backup file.");
    }
  };

  if (!goals || !settings) return null;

  return (
    <div className="space-y-5">
      <header className="pt-2">
        <h1 className="text-2xl font-bold gradient-text">Settings</h1>
        <p className="text-sm text-white/50">Goals, AI key & data.</p>
      </header>

      {/* Goals */}
      <GlassCard className="space-y-3">
        <h3 className="text-sm font-semibold">Daily Goals</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories (kcal)">
            <Input
              type="number"
              value={goals.calorieGoal}
              onChange={(e) => updateGoals({ calorieGoal: +e.target.value })}
            />
          </Field>
          <Field label="Protein (g)">
            <Input
              type="number"
              value={goals.proteinGoal}
              onChange={(e) => updateGoals({ proteinGoal: +e.target.value })}
            />
          </Field>
          <Field label="Carbs (g)">
            <Input type="number" value={goals.carbsGoal} onChange={(e) => updateGoals({ carbsGoal: +e.target.value })} />
          </Field>
          <Field label="Fat (g)">
            <Input type="number" value={goals.fatGoal} onChange={(e) => updateGoals({ fatGoal: +e.target.value })} />
          </Field>
          <Field label="Fiber (g)">
            <Input type="number" value={goals.fiberGoal} onChange={(e) => updateGoals({ fiberGoal: +e.target.value })} />
          </Field>
          <Field label="Water (ml)">
            <Input type="number" value={goals.waterGoalMl} onChange={(e) => updateGoals({ waterGoalMl: +e.target.value })} />
          </Field>
        </div>
      </GlassCard>

      {/* Weight goal */}
      <GlassCard className="space-y-3">
        <h3 className="text-sm font-semibold">Body & Target</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Goal weight (kg)">
            <Input type="number" value={goals.weightGoal} onChange={(e) => updateGoals({ weightGoal: +e.target.value })} />
          </Field>
          <Field label="Height (cm)">
            <Input type="number" value={goals.heightCm} onChange={(e) => updateGoals({ heightCm: +e.target.value })} />
          </Field>
          <Field label="Age">
            <Input type="number" value={goals.age} onChange={(e) => updateGoals({ age: +e.target.value })} />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/60">Sex</span>
            <Segmented
              value={goals.male ? "male" : "female"}
              onChange={(v) => updateGoals({ male: v === "male" })}
              options={[
                { label: "Male", value: "male" },
                { label: "Female", value: "female" },
              ]}
            />
          </div>
        </div>
      </GlassCard>

      {/* AI status (server-managed) */}
      <GlassCard className="space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-violet-300" />
          <h3 className="text-sm font-semibold">AI Status</h3>
        </div>
        <p className="text-[11px] text-white/40">
          The OpenRouter key is managed securely on the NutriAI server — it never
          touches your browser. Food recognition and the AI coach run through our
          Cloudflare Worker.
        </p>
        <AIStatus />
      </GlassCard>

      {/* Token / Usage Manager */}
      <TokenManager />

      {/* Appearance */}
      <GlassCard className="space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-fuchsia-300" />
          <h3 className="text-sm font-semibold">Appearance & Notifications</h3>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Reduce motion</span>
          <Segmented
            value={settings.reduceMotion ? "on" : "off"}
            onChange={(v) => updateSettings({ reduceMotion: v === "on" })}
            options={[
              { label: "Off", value: "off" },
              { label: "On", value: "on" },
            ]}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-white/70">
            <Bell className="h-4 w-4" /> Reminders
          </span>
          <Segmented
            value={settings.notifications ? "on" : "off"}
            onChange={(v) => updateSettings({ notifications: v === "on" })}
            options={[
              { label: "Off", value: "off" },
              { label: "On", value: "on" },
            ]}
          />
        </div>
      </GlassCard>

      {/* Data */}
      <GlassCard className="space-y-3">
        <h3 className="text-sm font-semibold">Your Data</h3>
        <div className="flex gap-2">
          <Button variant="glass" className="flex-1" onClick={onExport}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <label className="flex-1">
            <span className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold glass-soft text-white hover:bg-white/10">
              <Upload className="h-4 w-4" /> Import
            </span>
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => onImport(e.target.files?.[0])}
            />
          </label>
        </div>
        {importMsg && <p className="text-xs text-cyan-300">{importMsg}</p>}
        <p className="text-[11px] text-white/40">
          Data is stored privately in your browser (IndexedDB). NutriAI works fully
          offline.
        </p>
      </GlassCard>

      <p className="pb-4 text-center text-[11px] text-white/30">
        NutriAI · Snap. Eat. Track. · v1.0.0
      </p>
    </div>
  );
}

const DAILY_FREE = 50;

function AIStatus() {
  const { aiOnline } = useApp();
  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState<{ hasOpenRouterKey: boolean } | null>(null);

  const check = async () => {
    setChecking(true);
    try {
      const h = await apiClient.health();
      setHealth(h);
    } catch {
      setHealth(null);
    } finally {
      setChecking(false);
    }
  };

  const ok = health ? health.hasOpenRouterKey : aiOnline;
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-white/70">Server AI</span>
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          ok ? "bg-emerald-400/20 text-emerald-300" : "bg-rose-400/20 text-rose-300"
        }`}
      >
        {ok ? "Online" : "Unavailable"}
      </span>
      <Button variant="ghost" size="sm" onClick={check} loading={checking}>
        <RefreshCw className="h-4 w-4" /> Check
      </Button>
    </div>
  );
}

function TokenManager() {
  const { aiOnline } = useApp();
  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState<{ hasOpenRouterKey: boolean } | null>(null);

  const check = async () => {
    setChecking(true);
    try {
      setHealth(await apiClient.health());
    } catch {
      setHealth(null);
    } finally {
      setChecking(false);
    }
  };

  const online = health ? health.hasOpenRouterKey : aiOnline;
  const limit = DAILY_FREE;

  return (
    <GlassCard className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-cyan-300" />
          <h3 className="text-sm font-semibold">Token &amp; Usage Manager</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={check} loading={checking}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white/5 p-3">
          <div className="text-lg font-bold">{online ? "Active" : "Offline"}</div>
          <div className="text-[11px] text-white/50">AI engine status</div>
        </div>
        <div className="rounded-2xl bg-white/5 p-3">
          <div className="text-lg font-bold">{limit}</div>
          <div className="text-[11px] text-white/50">Free-tier daily cap (server)</div>
        </div>
      </div>

      <p className="text-[11px] text-white/40">
        Every scan and coach message counts as 1 request against the server's
        OpenRouter quota (including failed ones). Heavy use is rate-limited to
        protect the free tier.
      </p>
    </GlassCard>
  );
}
