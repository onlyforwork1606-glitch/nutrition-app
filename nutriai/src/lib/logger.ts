import * as Sentry from "@sentry/react";

let enabled = false;

/** Initialize Sentry. Only runs in production with a configured DSN. */
export function initLogger() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (dsn && import.meta.env.PROD) {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
    });
    enabled = true;
  }
}

/**
 * Reusable logging service for the frontend. Mirrors to the console and, when
 * Sentry is enabled (production only), forwards errors / breadcrumbs.
 */
export const logger = {
  isEnabled: () => enabled,

  info(msg: string, extra?: Record<string, unknown>) {
    console.log(`[info] ${msg}`, extra ?? "");
  },

  warn(msg: string, extra?: Record<string, unknown>) {
    console.warn(`[warn] ${msg}`, extra ?? "");
  },

  error(scope: string, err: unknown, extra?: Record<string, unknown>) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[error:${scope}] ${message}`, extra ?? "");
    if (enabled) {
      Sentry.captureException(err instanceof Error ? err : new Error(message), {
        extra: { scope, ...extra },
      });
    }
  },

  /** Capture a failed AI (OpenRouter) request originating from the client. */
  aiFailure(model: string | undefined, err: unknown, extra?: Record<string, unknown>) {
    this.error("ai", err, { model, ...extra });
  },

  /** Record API call latency (ms) as a Sentry breadcrumb. */
  apiLatency(path: string, ms: number) {
    if (enabled) {
      Sentry.addBreadcrumb({ category: "api", message: path, data: { ms } });
    }
  },
};
