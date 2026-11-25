// =====================================================================
// STAR RATINGS (runs on Cloudflare, not in the browser)
// GET  /api/rating?game=aquaris        -> { avg: 4.2, count: 12 }
// POST /api/rating  {game, stars}      -> saves one rating, returns the new average
// The ratings are stored in Cloudflare KV under the name "rating:<game>".
// =====================================================================

const okGame = g => typeof g === "string" && /^[a-z0-9-]{1,40}$/.test(g);

async function load(env, game) {
  return (await env.VINI_KV.get("rating:" + game, "json")) || { sum: 0, count: 0 };
}
const answer = d => Response.json({ avg: d.count ? Math.round((d.sum / d.count) * 10) / 10 : 0, count: d.count });

export async function onRequestGet({ request, env }) {
  const game = new URL(request.url).searchParams.get("game");
  if (!okGame(game)) return new Response("unknown game", { status: 400 });
  return answer(await load(env, game));
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return new Response("bad request", { status: 400 }); }
  const stars = Number(body.stars);
  if (!okGame(body.game) || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    return new Response("stars must be 1 to 5", { status: 400 });
  }
  const d = await load(env, body.game);
  d.sum += stars;
  d.count += 1;
  await env.VINI_KV.put("rating:" + body.game, JSON.stringify(d));
  return answer(d);
}
