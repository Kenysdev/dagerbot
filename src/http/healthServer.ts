import { createServer, type Server } from "node:http";

const BODY = '{"ok":true}';

// A Discord bot is an outbound client: it talks to the gateway over a WebSocket
// it opens itself, and needs no listening socket of its own. This one exists
// only for platforms that treat a bound port as the sign of a live deploy, which
// is why main.ts starts it only when PORT is set.
export function startHealthServer(port: number): Server {
  const server = createServer((req, res) => {
    const path = (req.url ?? "").split("?")[0].replace(/\/+$/, "");
    if (path !== "/health") {
      res.writeHead(404).end();
      return;
    }
    // Reading a health check must not change anything, so nothing but a read is
    // offered — otherwise every scanner reports an endpoint that answers POST.
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { allow: "GET, HEAD" }).end();
      return;
    }
    res.writeHead(200, {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(BODY),
    });
    res.end(BODY);
  });

  // Failing to bind must not take the bot down with it: the bot is the product
  // and it needs no socket to work. A platform that requires a bound port fails
  // the deploy on its own, which is the signal that belongs to it.
  server.on("error", (err) => {
    console.error("[health] endpoint disabled:", err.message);
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[health] listening on port ${port}`);
  });

  return server;
}
