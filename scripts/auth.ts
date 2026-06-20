#!/usr/bin/env tsx
/**
 * Interactive OAuth setup for WHOOP MCP.
 * Starts a local server, opens the browser, and saves tokens.
 */
import { createServer } from "node:http";
import { exec } from "node:child_process";
import { buildAuthUrl, exchangeCode, getAuthStatus } from "../src/auth.js";
import { DEFAULT_REDIRECT_URI, getConfig } from "../src/config.js";

const PORT = 8080;

async function openBrowser(url: string) {
  const cmd =
    process.platform === "darwin"
      ? `open "${url}"`
      : process.platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) console.log(`Open this URL manually:\n${url}`);
  });
}

async function main() {
  try {
    getConfig();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    console.error("\nCreate a .env file with WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET.");
    console.error("Register at https://developer.whoop.com");
    process.exit(1);
  }

  const status = await getAuthStatus();
  if (status.authenticated && status.message?.includes("valid")) {
    console.log("Already authenticated:", status);
    console.log("Re-authenticating...\n");
  }

  const { url, state } = buildAuthUrl();

  console.log("WHOOP OAuth Setup");
  console.log("=================");
  console.log(`Redirect URI: ${process.env.WHOOP_REDIRECT_URI ?? DEFAULT_REDIRECT_URI}`);
  console.log(`State: ${state}`);
  console.log("\nOpening browser for authorization...\n");

  const codePromise = new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const reqUrl = new URL(req.url ?? "/", `http://localhost:${PORT}`);

      if (reqUrl.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const code = reqUrl.searchParams.get("code");
      const returnedState = reqUrl.searchParams.get("state");
      const error = reqUrl.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h1>Authorization failed</h1><p>${error}</p>`);
        reject(new Error(`OAuth error: ${error}`));
        server.close();
        return;
      }

      if (returnedState !== state) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h1>State mismatch</h1><p>Possible CSRF — try again.</p>");
        reject(new Error("OAuth state mismatch"));
        server.close();
        return;
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h1>Missing code</h1>");
        reject(new Error("No authorization code received"));
        server.close();
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        "<h1>Success!</h1><p>WHOOP connected. You can close this tab and return to the terminal.</p>",
      );
      resolve(code);
      server.close();
    });

    server.listen(PORT, () => {
      openBrowser(url);
    });

    server.on("error", (err) => {
      reject(new Error(`Could not start callback server on port ${PORT}: ${err.message}`));
    });

    setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for authorization (5 minutes)"));
    }, 5 * 60 * 1000);
  });

  try {
    const code = await codePromise;
    const tokens = await exchangeCode(code);
    console.log("Authentication successful!");
    console.log(`  Scope: ${tokens.scope}`);
    console.log(`  Expires: ${new Date(tokens.expires_at).toISOString()}`);
    console.log(`  Tokens saved to ~/.whoop-mcp/tokens.json`);
    console.log("\nYou can now use the WHOOP MCP server in Cursor or Claude.");
  } catch (err) {
    console.error("\nAuthentication failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
