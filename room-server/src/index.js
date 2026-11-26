// =====================================================================
// VINI.GAMES ROOM SERVER (the "game server" for two players)
//
// Every 4-letter code is its own little room (a "Durable Object").
// Each player opens a connection to wss://room.vini.games/aq-CODE.
// When a player sends its state ("presence"), the room passes it on
// to the other player. That's all: the room does not play the game,
// the host player's browser does.
//
// Rules for safety:
// - only pages from vini.games may connect
// - at most 4 connections per room
// - messages bigger than 6 KB are ignored
// - nothing is stored after everyone leaves
// =====================================================================
import { DurableObject } from "cloudflare:workers";

const ALLOWED = [/^https:\/\/(www\.)?vini\.games$/, /^https:\/\/([a-z0-9-]+\.)?vini-games\.pages\.dev$/];

export class Room extends DurableObject {
  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const open = this.ctx.getWebSockets();
    if (open.length >= 4) return new Response("room full", { status: 403 });

    const [client, server] = Object.values(new WebSocketPair());
    const me = crypto.randomUUID().slice(0, 8);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: me, p: null });

    // tell the newcomer who it is and who is already here
    const peers = open
      .map(ws => ws.deserializeAttachment())
      .filter(a => a && a.p)
      .map(a => ({ peer: a.id, presence: a.p }));
    server.send(JSON.stringify({ t: "hello", me, peers }));

    return new Response(null, { status: 101, webSocket: client });
  }

  // a player sent its state -> pass it on to everyone else in the room
  webSocketMessage(ws, msg) {
    if (typeof msg !== "string" || msg.length > 6000) return;
    let m;
    try { m = JSON.parse(msg); } catch { return; }
    if (m.t !== "p") return;
    const a = ws.deserializeAttachment();
    a.p = m.d;
    ws.serializeAttachment(a);
    this.broadcast(ws, { t: "p", peer: a.id, presence: m.d });
  }

  webSocketClose(ws) {
    const a = ws.deserializeAttachment();
    if (a) this.broadcast(ws, { t: "left", peer: a.id });
  }
  webSocketError(ws) { this.webSocketClose(ws); }

  broadcast(from, data) {
    const out = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== from) { try { ws.send(out); } catch {} }
    }
  }
}

export default {
  async fetch(request, env) {
    const name = new URL(request.url).pathname.slice(1);
    if (!/^aq-[a-z0-9]{4}$/.test(name)) return new Response("vini.games room server");
    const origin = request.headers.get("Origin") || "";
    if (!ALLOWED.some(r => r.test(origin))) return new Response("forbidden", { status: 403 });
    return env.ROOMS.get(env.ROOMS.idFromName(name)).fetch(request);
  },
};
