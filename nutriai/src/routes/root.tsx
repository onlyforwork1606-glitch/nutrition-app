import { createRootRoute, Outlet } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { AICoach } from "@/components/coach/AICoach";
import ErrorBoundary from "@/components/layout/ErrorBoundary";
import { useApp } from "@/context/AppProvider";

const ThreeBackground = lazy(() =>
  import("@/components/background/ThreeBackground").then((m) => ({
    default: m.ThreeBackground,
  }))
);

export function RootComponent() {
  const { settings, ready } = useApp();
  const reduceMotion = settings?.reduceMotion ?? false;

  return (
    <ErrorBoundary>
      <div className="app-bg" />
      <Suspense fallback={null}>
        <ThreeBackground reduceMotion={reduceMotion} />
      </Suspense>
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col">
        <main className="flex-1 px-4 pb-32 pt-6">
          {ready ? (
            <Outlet />
          ) : (
            <div className="flex h-[60vh] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-violet-400" />
            </div>
          )}
        </main>
        <BottomNav />
        <AICoach />
      </div>
    </ErrorBoundary>
  );
}

export const rootRoute = createRootRoute({
  component: RootComponent,
});
