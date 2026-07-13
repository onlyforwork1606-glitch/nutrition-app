import {
  callOpenRouter,
  COACH_MODELS,
  COACH_SYSTEM_PROMPT,
  COACH_CHAT_PROMPT,
} from "./_openrouter";

interface Env {
  OPENROUTER_API_KEY?: string;
}

export const onRequestPost = async (ctx: { request: Request; env: Env }) => {
  const apiKey = ctx.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Server AI is not configured (OPENROUTER_API_KEY missing)." },
      { status: 503 }
    );
  }

  let body: { message?: unknown; context?: unknown; history?: unknown };
  try {
    body = await ctx.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const message = body?.message;
  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "Missing message." }, { status: 400 });
  }

  const context = typeof body?.context === "string" ? body.context : "";
  const historyRaw = Array.isArray(body?.history) ? body.history : [];

  const systemContent =
    `${COACH_SYSTEM_PROMPT}\n\n${COACH_CHAT_PROMPT}` +
    (context ? `\n\nCurrent nutrition context:\n${context}` : "");

  const history = historyRaw
    .filter(
      (m: any) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
    .map((m: any) => ({ role: m.role, content: m.content }));

  const messages = [
    { role: "system", content: systemContent },
    ...history,
    { role: "user", content: message },
  ];

  try {
    const completion = await callOpenRouter(apiKey, COACH_MODELS, messages, {
      temperature: 0.6,
      maxTokens: 900,
    });

    const reply: string = completion?.choices?.[0]?.message?.content ?? "";
    return Response.json({ message: reply.trim() });
  } catch (e: any) {
    return Response.json(
      { error: e?.message ?? "Coach request failed." },
      { status: 502 }
    );
  }
};
