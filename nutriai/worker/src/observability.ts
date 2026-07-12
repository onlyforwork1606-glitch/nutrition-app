/** Structured logging with request IDs and OpenRouter latency metrics. */

export interface LogMeta {
  requestId?: string;
  [key: string]: unknown;
}

export function log(level: "info" | "warn" | "error", msg: string, meta: LogMeta) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    env: (meta as any).env ?? "",
    ...meta,
  };
  // In production these are forwarded to Worker Analytics / a log drain.
  console.log(JSON.stringify(entry));
}

/** Measure async operation duration (ms). */
export async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = performance.now();
  const result = await fn();
  return [result, Math.round(performance.now() - start)];
}
