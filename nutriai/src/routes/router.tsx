import { createRoute, createRouter } from "@tanstack/react-router";
import { rootRoute } from "./root";
import { HomePage } from "./home";
import { ScanPage } from "./scan";
import { DiaryPage } from "./diary";
import { ProgressPage } from "./progress";
import { SettingsPage } from "./settings";

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const scanRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/scan",
  component: ScanPage,
});

const diaryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/diary",
  component: DiaryPage,
});

const progressRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/progress",
  component: ProgressPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  scanRoute,
  diaryRoute,
  progressRoute,
  settingsRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
