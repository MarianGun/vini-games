// =====================================================================
// IMPROVEMENT IDEAS (runs on Cloudflare, not in the browser)
// POST /api/feedback  {game, text}  -> saves the idea privately.
// Nobody else can read them: they never appear on the website.
// Vincent and his dad read them in Cloudflare under
// Storage & databases -> KV -> the namespace -> keys starting with "feedback:".
// =====================================================================

const okGame = g => typeof g === "string" && /^[a-z0-9-]{1,40}$/.test(g);

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return new Response("bad request", { status: 400 }); }
  const text = String(body.text || "").trim().slice(0, 500);
  if (!okGame(body.game) || text.length < 2) return new Response("empty", { status: 400 });
  const key = "feedback:" + body.game + ":" + new Date().toISOString() + ":" + Math.random().toString(36).slice(2, 6);
  await env.VINI_KV.put(key, JSON.stringify({ game: body.game, text, date: new Date().toISOString() }));
  return Response.json({ ok: true });
}
