import * as Sentry from "@sentry/cloudflare";
import type { Env } from "./types";

let enabled = false;

/** Enable Sentry reporting. Called from the Worker entry (withSentry) when a DSN is set. */
export function initLogger(env: Env) {
  enabled = !!(env && env.SENTRY_DSN && env.ENVIRONMENT !== "development");
}

/**
 * Reusable logging service. Mirrors structured logs to the console and, when
 * Sentry is enabled (production + DSN), forwards errors / breadcrumbs.
 * Sentry itself is initialized by `withSentry` in index.ts.
 */
export const logger = {
  init(env: Env) {
    initLogger(env);
  },

  info(msg: string, extra?: Record<string, unknown>) {
    console.log(JSON.stringify({ level: "info", msg, ...extra }));
  },

  warn(msg: string, extra?: Record<string, unknown>) {
    console.warn(JSON.stringify({ level: "warn", msg, ...extra }));
  },

  error(scope: string, err: unknown, extra?: Record<string, unknown>) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ level: "error", scope, msg: message, ...extra }));
    if (enabled) {
      Sentry.captureException(err instanceof Error ? err : new Error(message), {
        extra: { scope, ...extra },
      });
    }
  },

  /** Capture a failed AI (OpenRouter) request. */
  aiFailure(model: string, err: unknown, extra?: Record<string, unknown>) {
    this.error("ai", err, { model, ...extra });
  },

  /** Record API latency in ms (tracked as a Sentry breadcrumb). */
  apiLatency(path: string, ms: number) {
    console.log(JSON.stringify({ level: "info", msg: "api_latency", path, ms }));
    if (enabled) {
      Sentry.addBreadcrumb({ category: "api", message: path, data: { ms } });
    }
  },
};
