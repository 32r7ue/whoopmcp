import type { VercelRequest, VercelResponse } from "@vercel/node";
import { exchangeCode } from "../auth.js";
import { getConfig } from "../config.js";

export const config = {
  maxDuration: 30,
};

function sendHtml(res: VercelResponse, title: string, body: string, status = 200): void {
  res
    .status(status)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    getConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendHtml(res, "Configuration error", `<h1>Configuration error</h1><p>${message}</p>`, 500);
    return;
  }

  const { error, code, state } = req.query;
  const errorParam = typeof error === "string" ? error : undefined;
  const codeParam = typeof code === "string" ? code : undefined;
  const stateParam = typeof state === "string" ? state : undefined;

  if (errorParam) {
    sendHtml(res, "Authorization failed", `<h1>Authorization failed</h1><p>${errorParam}</p>`, 400);
    return;
  }

  if (!codeParam || !stateParam) {
    sendHtml(
      res,
      "Missing parameters",
      "<h1>Missing parameters</h1><p>Expected <code>code</code> and <code>state</code> query parameters.</p>",
      400,
    );
    return;
  }

  try {
    const tokens = await exchangeCode(codeParam, stateParam);
    sendHtml(
      res,
      "WHOOP connected",
      `<h1>Success!</h1>
<p>Your WHOOP account is connected. You can close this tab.</p>
<ul>
  <li>Scope: ${tokens.scope}</li>
  <li>Expires: ${new Date(tokens.expires_at).toISOString()}</li>
</ul>
<p>Return to Claude and use the remote WHOOP connector.</p>`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendHtml(res, "Token exchange failed", `<h1>Token exchange failed</h1><p>${message}</p>`, 500);
  }
}
