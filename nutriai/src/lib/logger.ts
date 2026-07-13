/**
 * Lightweight frontend logger. Mirrors to the console and records API latency.
 * (Sentry was removed during the Cloudflare Pages simplification — no extra
 * environment variables are required.)
 */

let enabled = false;

export function initLogger() {
  // No-op: there is no external error backend in the Pages deployment.
  enabled = false;
}

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
  },

  /** Capture a failed AI (OpenRouter) request originating from the client. */
  aiFailure(model: string | undefined, err: unknown, extra?: Record<string, unknown>) {
    this.error("ai", err, { model, ...extra });
  },

  /** Record API call latency (ms). */
  apiLatency(path: string, ms: number) {
    if (enabled) {
      console.debug(`[api:latency] ${path} ${ms}ms`);
    }
  },
};
