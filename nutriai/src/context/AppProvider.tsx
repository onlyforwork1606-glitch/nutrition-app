import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSettings,
  setSettings,
  getGoals,
  setGoals,
  type Backup,
} from "@/lib/db";
import type { Settings, Goals } from "@/lib/types";
import { apiClient } from "@/lib/api";

interface AppUser {
  id: string;
  email?: string;
  displayName?: string;
  authProvider: "anonymous" | "google" | "email";
  isGuest: boolean;
}

interface AppContextValue {
  settings: Settings | undefined;
  goals: Goals | undefined;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  updateGoals: (patch: Partial<Goals>) => Promise<void>;
  ready: boolean;
  hasKey: boolean;
  user: AppUser | null;
  aiOnline: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [aiOnline, setAiOnline] = useState(true);

  const settingsQ = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });
  const goalsQ = useQuery({
    queryKey: ["goals"],
    queryFn: getGoals,
  });

  // Resolve the server-managed auth session + AI availability on load.
  useEffect(() => {
    (async () => {
      try {
        const [session, health] = await Promise.all([
          apiClient.session().catch(() => null),
          apiClient.health().catch(() => null),
        ]);
        if (session?.user) setUser(session.user);
        if (health) setAiOnline(health.hasOpenRouterKey);
      } catch {
        /* offline or unreachable — AI features degrade gracefully */
      }
    })();
  }, []);

  useEffect(() => {
    if (settingsQ.data && goalsQ.data) setReady(true);
  }, [settingsQ.data, goalsQ.data]);

  const updateSettings = async (patch: Partial<Settings>) => {
    const next = { ...(settingsQ.data as Settings), ...patch };
    await setSettings(next);
    qc.setQueryData(["settings"], next);
  };

  const updateGoals = async (patch: Partial<Goals>) => {
    const next = { ...(goalsQ.data as Goals), ...patch };
    await setGoals(next);
    qc.setQueryData(["goals"], next);
  };

  // AI is enabled as long as the server has a key configured.
  const hasKey = aiOnline;

  return (
    <AppContext.Provider
      value={{
        settings: settingsQ.data,
        goals: goalsQ.data,
        updateSettings,
        updateGoals,
        ready,
        hasKey,
        user,
        aiOnline,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export type { Backup };
