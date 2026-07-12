import type { Env, AuthUser, AppContext } from "./types";
import { LIMITS } from "./env";
import { log } from "./observability";

/* --------------------------- Session (HS256 JWT) --------------------------- */

function b64url(input: ArrayBuffer | string): string {
  const str =
    typeof input === "string"
      ? input
      : String.fromCharCode(...new Uint8Array(input));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlJson(obj: unknown): string {
  return b64url(JSON.stringify(obj));
}

async function hmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64url(sig);
}

export async function signSession(
  user: { id: string; provider: string },
  secret: string,
  ttlSeconds = 60 * 60 * 24 * 30
): Promise<string> {
  const header = b64urlJson({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const payload = b64urlJson({ sub: user.id, prv: user.provider, iat: now, exp: now + ttlSeconds });
  const data = `${header}.${payload}`;
  const sig = await hmac(data, secret);
  return `${data}.${sig}`;
}

export async function verifySession(
  token: string | undefined,
  secret: string
): Promise<{ id: string; provider: string } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = await hmac(`${header}.${payload}`, secret);
  // constant-time compare
  if (sig.length !== expected.length || sig !== expected) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (json.exp && json.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: json.sub, provider: json.prv };
  } catch {
    return null;
  }
}

/* ------------------------------- Security -------------------------------- */

export function securityHeaders(c: AppContext) {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
  );
  c.header(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
}

export function cors(c: AppContext, env: Env) {
  const origin = c.req.header("origin");
  const allowed = env.FRONTEND_URL;
  if (origin && (origin === allowed || env.ENVIRONMENT === "development")) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  }
}

/* ------------------------------ Rate limit ------------------------------- */

export async function rateLimit(
  env: Env,
  key: string,
  requestId: string
): Promise<{ ok: boolean; remaining: number }> {
  const now = Date.now();
  const minute = Math.floor(now / 60_000);
  const day = new Date().toISOString().slice(0, 10);

  const minKey = `rl:${key}:min:${minute}`;
  const dayKey = `rl:${key}:day:${day}`;

  const minRes = await env.KV.get(minKey);
  const dayRes = await env.KV.get(dayKey);
  const minCount = minRes ? parseInt(minRes, 10) : 0;
  const dayCount = dayRes ? parseInt(dayRes, 10) : 0;

  const dailyLimit =
    env.OPENROUTER_API_KEY && env.ENVIRONMENT !== "development"
      ? LIMITS.creditedDailyRequests
      : LIMITS.freeDailyRequests;

  if (minCount >= LIMITS.perMinuteRequests || dayCount >= dailyLimit) {
    log("warn", "rate_limited", { requestId, key, minCount, dayCount });
    return { ok: false, remaining: Math.max(0, dailyLimit - dayCount) };
  }

  await env.KV.put(minKey, String(minCount + 1), { expirationTtl: 120 });
  await env.KV.put(dayKey, String(dayCount + 1), {
    expirationTtl: 60 * 60 * 24 + 60,
  });
  return { ok: true, remaining: dailyLimit - dayCount - 1 };
}

/* --------------------------------- Auth ----------------------------------- */

export async function getOrCreateUser(
  env: Env,
  c: AppContext,
  requestId: string
): Promise<AuthUser> {
  const cookie = c.req.header("cookie");
  const token = cookie
    ?.split(";")
    .find((x: string) => x.trim().startsWith("nutriai_session="))
    ?.split("=")[1];

  const verified = await verifySession(token, env.SESSION_SECRET);
  if (verified) {
    const row = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
      .bind(verified.id)
      .first<any>();
    if (row && !row.deleted_at) {
      return {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        authProvider: row.auth_provider,
        isGuest: !!row.is_guest,
      };
    }
  }

  // Anonymous / guest creation
  const id = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO users (id, auth_provider, is_guest, created_at, updated_at)
     VALUES (?, 'anonymous', 1, ?, ?)`
  )
    .bind(id, now, now)
    .run();

  const session = await signSession({ id, provider: "anonymous" }, env.SESSION_SECRET);
  c.header(
    "Set-Cookie",
    `nutriai_session=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`
  );
  log("info", "user_created_anonymous", { requestId, userId: id });
  return { id, authProvider: "anonymous", isGuest: true };
}
