interface Env {
  OPENROUTER_API_KEY?: string;
}

export const onRequestGet = async (ctx: { env: Env }) => {
  return Response.json({
    status: "ok",
    hasOpenRouterKey: Boolean(ctx.env.OPENROUTER_API_KEY),
  });
};
