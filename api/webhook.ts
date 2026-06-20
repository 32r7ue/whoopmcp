import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function verifySignature(
  rawBody: string,
  timestamp: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac("sha256", secret)
    .update(timestamp + rawBody)
    .digest("base64");

  const received = Buffer.from(signature);
  const computed = Buffer.from(expected);

  if (received.length !== computed.length) {
    return false;
  }

  return timingSafeEqual(received, computed);
}

export default async function handler(
  req: IncomingMessage & { method?: string; headers: Record<string, string | string[] | undefined> },
  res: ServerResponse & { status: (code: number) => { json: (body: unknown) => void } },
) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "whoop-mcp-webhook",
      message: "POST WHOOP webhook events to this URL. Model version: v2.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.WHOOP_CLIENT_SECRET;
  const rawBody = await readRawBody(req);

  // Bootstrap mode: no secret yet (deploy Vercel first, create WHOOP app, then add secret).
  if (!secret) {
    console.warn("WHOOP webhook: WHOOP_CLIENT_SECRET not set — accepting without signature check");
    try {
      const event = JSON.parse(rawBody);
      console.log("WHOOP webhook (bootstrap):", event.type, event.id);
    } catch {
      /* ignore */
    }
    return res.status(200).json({ received: true, bootstrap: true });
  }

  const signature = req.headers["x-whoop-signature"];
  const timestamp = req.headers["x-whoop-signature-timestamp"];

  if (typeof signature !== "string" || typeof timestamp !== "string") {
    return res.status(401).json({ error: "Missing WHOOP signature headers" });
  }

  if (!verifySignature(rawBody, timestamp, signature, secret)) {
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  try {
    const event = JSON.parse(rawBody) as {
      type?: string;
      id?: string | number;
      user_id?: number;
      trace_id?: string;
    };
    console.log("WHOOP webhook received:", event.type, event.id, event.trace_id);
  } catch {
    console.log("WHOOP webhook received (unparsed body)");
  }

  return res.status(200).json({ received: true });
}
