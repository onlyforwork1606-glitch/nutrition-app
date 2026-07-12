import { Hono } from "hono";
import { z } from "zod";
import type { Env, AppEnv } from "./types";
import { securityHeaders, cors, rateLimit, getOrCreateUser } from "./middleware";
import { NutritionService, type EnrichedFood } from "./services/nutrition";
import { CoachService } from "./services/coach";
import { Repo } from "./services/db";
import { complete } from "./services/openrouter";
import {
  AI_CONFIG,
  VISION_PROMPT,
  VISION_OUTPUT_HINT,
  CONFIDENCE_THRESHOLD,
} from "./config";
import { logger } from "./logger";
import { withSentry } from "@sentry/cloudflare";

const app = new Hono<AppEnv>();

/* request id + security + cors + latency for all API routes */
app.use("*", async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  logger.init(c.env);
  securityHeaders(c);
  cors(c, c.env);
  if (c.req.method === "OPTIONS") return c.body(null, 204);
  const start = performance.now();
  await next();
  const ms = Math.round(performance.now() - start);
  logger.apiLatency(c.req.path, ms);
});

app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    environment: c.env.ENVIRONMENT,
    hasOpenRouterKey: !!c.env.OPENROUTER_API_KEY,
    time: new Date().toISOString(),
  });
});

/* --------------------------------- Vision -------------------------------- */

const VisionSchema = z.object({
  image: z.string().min(10), // data URL or base64
  date: z.string().optional(),
});

app.post("/api/vision", async (c) => {
  const requestId = c.get("requestId");
  const user = await getOrCreateUser(c.env, c, requestId);
  const rl = await rateLimit(c.env, user.id, requestId);
  if (!rl.ok) return c.json({ error: "rate_limited", remaining: rl.remaining }, 429);

  const body = await c.req.json().catch(() => null);
  const parsed = VisionSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid_request" }, 400);

  const { image } = parsed.data;
  const { mime, bytes } = decodeImage(image);
  if (!mime || !bytes) return c.json({ error: "invalid_image" }, 400);
  if (bytes.byteLength > 10 * 1024 * 1024) return c.json({ error: "image_too_large" }, 413);

  const key = `tmp/${crypto.randomUUID()}.${extFromMime(mime)}`;
  let url: string;
  try {
    await c.env.IMAGES.put(key, bytes, { httpMetadata: { contentType: mime } });
    url = `${c.env.R2_PUBLIC_URL}/${key}`;
  } catch (e) {
    logger.error("r2", e, { op: "put", requestId });
    return c.json({ error: "image_upload_failed" }, 502);
  }

  const nutrition = new NutritionService(c.env);
  try {
    await nutrition.seedIfEmpty();
  } catch (e) {
    logger.error("d1", e, { op: "seedIfEmpty", requestId });
  }

  const messages = [
    { role: "system" as const, content: `${VISION_PROMPT}\n${VISION_OUTPUT_HINT}` },
    {
      role: "user" as const,
      content: [
        { type: "text", text: "Identify the foods in this image." } as any,
        { type: "image_url", image_url: { url } } as any,
      ],
    },
  ];

  let raw: string;
  try {
    const res = await complete(
      c.env,
      [AI_CONFIG.visionModel, ...AI_CONFIG.visionFallbacks],
      messages,
      { temperature: AI_CONFIG.visionTemperature, maxTokens: AI_CONFIG.visionMaxTokens },
      requestId
    );
    raw = res.content;
  } catch (e) {
    logger.error("ai", e, { op: "vision", requestId });
    return c.json({ error: "vision_failed" }, 502);
  }

  const foods = parseFoods(raw);
  if (!foods) return c.json({ error: "vision_parse_error", raw }, 422);

  let enriched: EnrichedFood[];
  try {
    enriched = await nutrition.enrich(foods);
  } catch (e) {
    logger.error("nutrition", e, { op: "enrich", requestId });
    enriched = foods.map((f) => ({
      ...f,
      confidence: f.confidence ?? 0.4,
      source: "ai" as const,
      needsConfirmation: true,
    }));
  }

  // Persist the scanned meal (D1) — best-effort, failures are logged.
  try {
    const repo = new Repo(c.env);
    await repo.saveMeal(user.id, {
      id: crypto.randomUUID(),
      date: parsed.data.date ?? new Date().toISOString().slice(0, 10),
      type: "snacks",
      note: "scanned",
      items: enriched,
    });
  } catch (e) {
    logger.error("d1", e, { op: "saveMeal", requestId });
  }

  return c.json({ foods: enriched, confirmThreshold: CONFIDENCE_THRESHOLD });
});

/* --------------------------------- Coach --------------------------------- */

app.get("/api/coach", async (c) => {
  const requestId = c.get("requestId");
  const user = await getOrCreateUser(c.env, c, requestId);
  const repo = new Repo(c.env);
  const history = await repo.getCoachHistory(user.id, 30);
  return c.json({ messages: history });
});

app.post("/api/coach", async (c) => {
  const requestId = c.get("requestId");
  const user = await getOrCreateUser(c.env, c, requestId);
  const rl = await rateLimit(c.env, user.id, requestId);
  if (!rl.ok) return c.json({ error: "rate_limited", remaining: rl.remaining }, 429);

  const body = await c.req.json().catch(() => null);
  const message = body?.message;
  if (!message || typeof message !== "string") return c.json({ error: "invalid_request" }, 400);

  const coach = new CoachService(c.env);
  try {
    const res = await coach.chat(
      user.id,
      message,
      new Date().toISOString().slice(0, 10),
      requestId,
      typeof body?.context === "string" ? body.context : undefined,
      Array.isArray(body?.history) ? body.history : undefined
    );
    return c.json(res);
  } catch (e) {
    logger.error("ai", e, { op: "coach", requestId });
    return c.json({ error: "coach_failed" }, 502);
  }
});

/* ------------------------------- Data sync ------------------------------- */

app.get("/api/goals", async (c) => {
  const requestId = c.get("requestId");
  const user = await getOrCreateUser(c.env, c, requestId);
  const repo = new Repo(c.env);
  return c.json(await repo.getGoals(user.id));
});

app.put("/api/goals", async (c) => {
  const requestId = c.get("requestId");
  const user = await getOrCreateUser(c.env, c, requestId);
  const body = await c.req.json().catch(() => ({}));
  await new Repo(c.env).createGoals(user.id, body);
  return c.json({ ok: true });
});

app.get("/api/meals", async (c) => {
  const requestId = c.get("requestId");
  const user = await getOrCreateUser(c.env, c, requestId);
  const date = c.req.query("date") ?? new Date().toISOString().slice(0, 10);
  return c.json(await new Repo(c.env).getMeals(user.id, date));
});

app.post("/api/meals", async (c) => {
  const requestId = c.get("requestId");
  const user = await getOrCreateUser(c.env, c, requestId);
  const body = await c.req.json().catch(() => null);
  if (!body?.id) return c.json({ error: "invalid_request" }, 400);
  await new Repo(c.env).saveMeal(user.id, body);
  return c.json({ ok: true });
});

app.post("/api/weight", async (c) => {
  const requestId = c.get("requestId");
  const user = await getOrCreateUser(c.env, c, requestId);
  const b = await c.req.json().catch(() => null);
  if (!b?.weight) return c.json({ error: "invalid_request" }, 400);
  await new Repo(c.env).logWeight(user.id, b.date ?? new Date().toISOString().slice(0, 10), b.weight);
  return c.json({ ok: true });
});

app.post("/api/water", async (c) => {
  const requestId = c.get("requestId");
  const user = await getOrCreateUser(c.env, c, requestId);
  const b = await c.req.json().catch(() => null);
  if (!b?.amount) return c.json({ error: "invalid_request" }, 400);
  await new Repo(c.env).logWater(user.id, b.date ?? new Date().toISOString().slice(0, 10), b.amount);
  return c.json({ ok: true });
});

app.post("/api/exercise", async (c) => {
  const requestId = c.get("requestId");
  const user = await getOrCreateUser(c.env, c, requestId);
  const b = await c.req.json().catch(() => null);
  if (!b?.activity) return c.json({ error: "invalid_request" }, 400);
  await new Repo(c.env).logExercise(user.id, b);
  return c.json({ ok: true });
});

app.get("/api/progress", async (c) => {
  const requestId = c.get("requestId");
  const user = await getOrCreateUser(c.env, c, requestId);
  return c.json(await new Repo(c.env).getProgress(user.id));
});

/* --------------------------------- Auth ---------------------------------- */

app.get("/api/auth/session", async (c) => {
  const requestId = c.get("requestId");
  const user = await getOrCreateUser(c.env, c, requestId);
  return c.json({ user });
});

app.get("/api/auth/google", async (c) => {
  const state = crypto.randomUUID();
  await c.env.KV.put(`oauth:state:${state}`, "1", { expirationTtl: 600 });
  const url =
    `https://accounts.google.com/o/oauth2/v2/auth?client_id=${c.env.GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(c.env.GOOGLE_REDIRECT_URI ?? "")}` +
    `&response_type=code&scope=openid%20email%20profile&state=${state}`;
  return c.redirect(url, 302);
});

app.get("/api/auth/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code || !state) return c.json({ error: "invalid_callback" }, 400);
  const ok = await c.env.KV.get(`oauth:state:${state}`);
  if (!ok) return c.json({ error: "bad_state" }, 400);
  await c.env.KV.delete(`oauth:state:${state}`);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: c.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: c.env.GOOGLE_REDIRECT_URI ?? "",
      grant_type: "authorization_code",
    }),
  });
  const token = await tokenRes.json<{ access_token: string }>();
  const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const info = await infoRes.json<{ sub: string; email: string; name: string }>();

  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO users (id, email, google_id, display_name, auth_provider, is_guest, created_at, updated_at)
     VALUES (?,?,?,?, 'google', 0, ?, ?)
     ON CONFLICT(id) DO UPDATE SET email=excluded.email, google_id=excluded.google_id,
       display_name=excluded.display_name, auth_provider='google', is_guest=0, updated_at=?`
  )
    .bind(crypto.randomUUID(), info.email, info.sub, info.name, now, now, now)
    .run();

  // reuse google_id to fetch user id
  const row = await c.env.DB.prepare("SELECT id FROM users WHERE google_id = ?")
    .bind(info.sub)
    .first<{ id: string }>();
  const session = await import("./middleware").then((m) =>
    m.signSession({ id: row!.id, provider: "google" }, c.env.SESSION_SECRET)
  );
  c.header(
    "Set-Cookie",
    `nutriai_session=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`
  );
  return c.redirect(c.env.FRONTEND_URL, 302);
});

app.post("/api/auth/logout", async (c) => {
  c.header("Set-Cookie", "nutriai_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  return c.json({ ok: true });
});

/* -------------------------------- Export --------------------------------- */

const handler = {
  async fetch(request: Request, env: Env, ctx: any) {
    logger.init(env);
    const url = new URL(request.url);

    // API routes are handled by the Hono app.
    if (url.pathname.startsWith("/api/")) {
      try {
        return await app.fetch(request, env, ctx);
      } catch (e) {
        logger.error("worker", e, { path: url.pathname });
        return new Response(JSON.stringify({ error: "internal_error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Everything else is the SPA (PWA). The platform's SPA fallback serves
    // index.html for client-side routes; assets are served directly.
    return env.ASSETS.fetch(request);
  },
  async scheduled(event: any, env: Env, ctx: any) {
    logger.init(env);
    ctx.waitUntil(
      handleScheduled(event, env).catch((e) => logger.error("scheduled", e, { cron: event.cron }))
    );
  },
};

export default withSentry(
  (env) => ({
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT,
    tracesSampleRate: 0.1,
  }),
  handler
);

export class CoachDurable {
  constructor(_state: any, _env: any) {}
  async fetch() {
    return new Response("ok");
  }
}

async function handleScheduled(event: any, env: Env) {
  const kind = event.cron.includes("1 * *") ? "monthly" : "weekly";
  const users = await env.DB.prepare("SELECT id FROM users WHERE is_guest = 0 AND deleted_at IS NULL")
    .all<any>();
  const coach = new CoachService(env);
  for (const u of users.results ?? []) {
    try {
      const report = await coach.report(u.id, kind, crypto.randomUUID());
      await new Repo(env).addCoachMessage(u.id, "assistant", `[${kind} report]\n${report}`);
      logger.info("scheduled_report", { userId: u.id, kind });
    } catch (e) {
      logger.error("scheduled", e, { op: "scheduled_report", userId: u.id, kind });
    }
  }
}

/* ------------------------------- Helpers --------------------------------- */

function decodeImage(dataUrl: string): { mime: string; bytes: Uint8Array } | { mime: null; bytes: null } {
  const match = dataUrl.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.*)$/);
  if (match) {
    return { mime: match[1], bytes: base64ToBytes(match[2]) };
  }
  // assume raw base64 with jpeg default
  try {
    return { mime: "image/jpeg", bytes: base64ToBytes(dataUrl) };
  } catch {
    return { mime: null, bytes: null };
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function extFromMime(mime: string): string {
  return mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
}

interface ParsedFood {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  confidence?: number;
  source: "ai";
}

function parseFoods(raw: string): ParsedFood[] | null {
  let json = raw.trim();
  const fence = json.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) json = fence[1];
  const obj = JSON.parse(json);
  if (!obj?.foods || !Array.isArray(obj.foods)) return null;
  return obj.foods.map((f: any) => ({
    name: String(f.name ?? "Unknown"),
    portion: String(f.portion ?? ""),
    calories: Number(f.calories ?? 0),
    protein: Number(f.protein ?? 0),
    carbs: Number(f.carbs ?? 0),
    fat: Number(f.fat ?? 0),
    fiber: Number(f.fiber ?? 0),
    confidence: f.confidence != null ? Number(f.confidence) : undefined,
    source: "ai",
  }));
}
