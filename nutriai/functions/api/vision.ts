import {
  callOpenRouter,
  extractJson,
  VISION_MODELS,
  VISION_PROMPT,
  VISION_OUTPUT_HINT,
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

  let body: { image?: unknown; date?: unknown };
  try {
    body = await ctx.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const image = body?.image;
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return Response.json({ error: "Missing or invalid image." }, { status: 400 });
  }

  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: `${VISION_PROMPT}\n\n${VISION_OUTPUT_HINT}` },
        { type: "image_url", image_url: { url: image } },
      ],
    },
  ];

  try {
    const completion = await callOpenRouter(apiKey, VISION_MODELS, messages, {
      temperature: 0.2,
      maxTokens: 1200,
      jsonMode: true,
    });

    const content: string = completion?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content);
    const rawFoods: any[] = Array.isArray(parsed?.foods) ? parsed.foods : [];

    const foods = rawFoods.map((f) => ({
      name: String(f?.name ?? "Unknown food"),
      portion: String(f?.portion ?? ""),
      calories: Number(f?.calories ?? 0),
      protein: Number(f?.protein ?? 0),
      carbs: Number(f?.carbs ?? 0),
      fat: Number(f?.fat ?? 0),
      fiber: Number(f?.fiber ?? 0),
      confidence:
        typeof f?.confidence === "number"
          ? Math.min(1, Math.max(0, f.confidence))
          : undefined,
      source: "ai",
    }));

    return Response.json({ foods });
  } catch (e: any) {
    return Response.json(
      { error: e?.message ?? "Vision analysis failed." },
      { status: 502 }
    );
  }
};
