import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: join(projectRoot, ".env") });
loadEnv({ path: join(process.cwd(), ".env") });

export const WHOOP_API_BASE = "https://api.prod.whoop.com";
export const WHOOP_DEVELOPER_API_BASE = `${WHOOP_API_BASE}/developer`;
export const WHOOP_AUTH_URL = `${WHOOP_API_BASE}/oauth/oauth2/auth`;
export const WHOOP_TOKEN_URL = `${WHOOP_API_BASE}/oauth/oauth2/token`;

export const DEFAULT_SCOPES = [
  "offline",
  "read:profile",
  "read:body_measurement",
  "read:cycles",
  "read:recovery",
  "read:sleep",
  "read:workout",
] as const;

export const DEFAULT_REDIRECT_URI = "http://localhost:8080/callback";
export const DEFAULT_OAUTH_CALLBACK_PATH = "/api/oauth/callback";
export const TOKEN_DIR = join(homedir(), ".whoop-mcp");
export const TOKEN_FILE = join(TOKEN_DIR, "tokens.json");

export function getRedirectUri(): string {
  if (process.env.WHOOP_REDIRECT_URI) {
    return process.env.WHOOP_REDIRECT_URI;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}${DEFAULT_OAUTH_CALLBACK_PATH}`;
  }

  return DEFAULT_REDIRECT_URI;
}

export function getConfig() {
  const clientId = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;
  const redirectUri = getRedirectUri();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing WHOOP_CLIENT_ID or WHOOP_CLIENT_SECRET. Register an app at https://developer.whoop.com and set these environment variables.",
    );
  }

  return { clientId, clientSecret, redirectUri };
}
