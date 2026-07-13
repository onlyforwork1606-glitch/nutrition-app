import { logger } from "./logger";

export class ApiError extends Error {
  constructor(message: string, public status: number, public data?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal }
): Promise<T> {
  const start = performance.now();
  try {
    const res = await fetch(path, {
      method: options.method ?? "POST",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });

    const isJson = res.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await res.json().catch(() => null) : null;

    if (!res.ok) {
      const msg =
        (data as any)?.error === "rate_limited"
          ? "Daily AI limit reached. Try again tomorrow, or the server will reset."
          : (data as any)?.error || `Request failed (${res.status})`;
      logger.error("api", new Error(msg), { path, status: res.status });
      throw new ApiError(msg, res.status, data);
    }
    return data as T;
  } catch (e) {
    if (!(e instanceof ApiError)) {
      logger.error("api", e, { path });
    }
    throw e;
  } finally {
    logger.apiLatency(path, Math.round(performance.now() - start));
  }
}

export const apiClient = {
  health: () =>
    request<{ status: string; hasOpenRouterKey: boolean }>("/api/health", {
      method: "GET",
    }),
  vision: (image: string, date?: string, signal?: AbortSignal) =>
    request<{ foods: any[] }>("/api/vision", { body: { image, date }, signal }),
  chat: (
    message: string,
    context?: string,
    history?: { role: "user" | "assistant"; content: string }[],
    signal?: AbortSignal
  ) =>
    request<{ message: string }>("/api/chat", {
      body: { message, context, history },
      signal,
    }),
};
