const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || "";

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
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "POST",
    // The session cookie is HttpOnly and scoped to the API origin;
    // include it on cross-origin requests so the Worker can identify the user.
    credentials: "include",
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
    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  health: () => request<{ status: string; hasOpenRouterKey: boolean }>("/api/health", { method: "GET" }),
  vision: (image: string, date?: string, signal?: AbortSignal) =>
    request<{ foods: any[] }>("/api/vision", { body: { image, date }, signal }),
  coachChat: (
    message: string,
    context?: string,
    history?: { role: "user" | "assistant"; content: string }[],
    signal?: AbortSignal
  ) =>
    request<{ message: string }>("/api/coach", { body: { message, context, history }, signal }),
  coachHistory: () => request<{ messages: any[] }>("/api/coach", { method: "GET" }),
  getGoals: () => request<any>("/api/goals", { method: "GET" }),
  saveGoals: (g: any) => request<{ ok: true }>("/api/goals", { body: g }),
  getMeals: (date: string) => request<any>("/api/meals?date=" + date, { method: "GET" }),
  saveMeal: (m: any) => request<{ ok: true }>("/api/meals", { body: m }),
  logWeight: (b: any) => request<{ ok: true }>("/api/weight", { body: b }),
  logWater: (b: any) => request<{ ok: true }>("/api/water", { body: b }),
  logExercise: (b: any) => request<{ ok: true }>("/api/exercise", { body: b }),
  getProgress: () => request<any>("/api/progress", { method: "GET" }),
  session: () => request<{ user: any }>("/api/auth/session", { method: "GET" }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
};
