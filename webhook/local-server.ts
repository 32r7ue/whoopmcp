/**
 * Local webhook server for testing with ngrok.
 * Usage: npx tsx webhook/local-server.ts
 * Then: ngrok http 3000 → use https://xxxx.ngrok.io/webhook in WHOOP dashboard
 */
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getConfig } from "../src/config.js";

const PORT = Number(process.env.WEBHOOK_PORT ?? 3000);

function verifySignature(
  rawBody: string,
  timestamp: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac("sha256", secret)
    .update(timestamp + rawBody)
    .digest("base64");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const { clientSecret } = getConfig();

const server = createServer(async (req, res) => {
  if (req.url === "/webhook" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "whoop-mcp-webhook-local" }));
    return;
  }

  if (req.url !== "/webhook" || req.method !== "POST") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks).toString("utf8");

  const signature = req.headers["x-whoop-signature"];
  const timestamp = req.headers["x-whoop-signature-timestamp"];

  if (typeof signature !== "string" || typeof timestamp !== "string") {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing signature headers" }));
    return;
  }

  if (!verifySignature(rawBody, timestamp, signature, clientSecret)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid signature" }));
    return;
  }

  const event = JSON.parse(rawBody);
  console.log("Webhook:", event.type, event.id);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ received: true }));
});

server.listen(PORT, () => {
  console.log(`Webhook server listening on http://localhost:${PORT}/webhook`);
  console.log("Run: ngrok http", PORT);
});
