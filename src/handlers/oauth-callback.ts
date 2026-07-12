import { exchangeCode } from "../auth.js";
import { getConfig } from "../config.js";

export const config = {
  runtime: "edge",
  maxDuration: 30,
};

function htmlPage(title: string, body: string, status = 200): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export default async function handler(request: Request): Promise<Response> {
  try {
    getConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return htmlPage("Configuration error", `<h1>Configuration error</h1><p>${message}</p>`, 500);
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) {
    return htmlPage(
      "Authorization failed",
      `<h1>Authorization failed</h1><p>${error}</p>`,
      400,
    );
  }

  if (!code || !state) {
    return htmlPage(
      "Missing parameters",
      "<h1>Missing parameters</h1><p>Expected <code>code</code> and <code>state</code> query parameters.</p>",
      400,
    );
  }

  try {
    const tokens = await exchangeCode(code, state);
    return htmlPage(
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
    return htmlPage("Token exchange failed", `<h1>Token exchange failed</h1><p>${message}</p>`, 500);
  }
}
