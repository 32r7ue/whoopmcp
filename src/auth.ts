import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import {
  DEFAULT_SCOPES,
  getConfig,
  TOKEN_DIR,
  TOKEN_FILE,
  WHOOP_API_BASE,
  WHOOP_AUTH_URL,
  WHOOP_TOKEN_URL,
} from "./config.js";
import type { TokenData } from "./types.js";

let refreshPromise: Promise<TokenData> | null = null;

async function ensureTokenDir(): Promise<void> {
  await mkdir(TOKEN_DIR, { recursive: true, mode: 0o700 });
}

export async function loadTokens(): Promise<TokenData | null> {
  try {
    const raw = await readFile(TOKEN_FILE, "utf-8");
    return JSON.parse(raw) as TokenData;
  } catch {
    return null;
  }
}

export async function saveTokens(tokens: TokenData): Promise<void> {
  await ensureTokenDir();
  await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  await chmod(TOKEN_FILE, 0o600);
}

function tokenResponseToData(data: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}, existingRefresh?: string): TokenData {
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? existingRefresh ?? "",
    expires_at: Date.now() + data.expires_in * 1000 - 60_000,
    scope: data.scope,
    token_type: data.token_type,
  };
}

export function buildAuthUrl(state?: string): { url: string; state: string } {
  const { clientId, redirectUri } = getConfig();
  const authState = state ?? randomBytes(4).toString("hex");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: DEFAULT_SCOPES.join(" "),
    state: authState,
  });

  return {
    url: `${WHOOP_AUTH_URL}?${params.toString()}`,
    state: authState,
  };
}

export async function exchangeCode(code: string): Promise<TokenData> {
  const { clientId, clientSecret, redirectUri } = getConfig();

  const response = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const tokens = tokenResponseToData(data);
  await saveTokens(tokens);
  return tokens;
}

async function refreshTokensInternal(refreshToken: string): Promise<TokenData> {
  const { clientId, clientSecret } = getConfig();

  const response = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      scope: "offline",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const tokens = tokenResponseToData(data, refreshToken);
  await saveTokens(tokens);
  return tokens;
}

export async function refreshTokens(): Promise<TokenData> {
  const existing = await loadTokens();
  if (!existing?.refresh_token) {
    throw new Error("No refresh token available. Run `npm run auth` to authenticate.");
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = refreshTokensInternal(existing.refresh_token).finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function getValidAccessToken(): Promise<string> {
  const tokens = await loadTokens();
  if (!tokens) {
    throw new Error(
      "Not authenticated. Use the whoop_get_auth_url tool or run `npm run auth` to connect your WHOOP account.",
    );
  }

  if (Date.now() >= tokens.expires_at) {
    const refreshed = await refreshTokens();
    return refreshed.access_token;
  }

  return tokens.access_token;
}

export async function getAuthStatus(): Promise<{
  authenticated: boolean;
  expires_at?: string;
  scope?: string;
  message?: string;
}> {
  const tokens = await loadTokens();
  if (!tokens) {
    return {
      authenticated: false,
      message: "No tokens found. Run `npm run auth` or use whoop_get_auth_url.",
    };
  }

  const expired = Date.now() >= tokens.expires_at;
  return {
    authenticated: true,
    expires_at: new Date(tokens.expires_at).toISOString(),
    scope: tokens.scope,
    message: expired
      ? "Access token expired but refresh token is available — will auto-refresh on next API call."
      : "Access token is valid.",
  };
}

export async function revokeAccess(): Promise<void> {
  const accessToken = await getValidAccessToken();

  const response = await fetch(`${WHOOP_API_BASE}/v2/user/access`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 204) {
    const body = await response.text();
    throw new Error(`Revoke failed (${response.status}): ${body}`);
  }

  const { unlink } = await import("node:fs/promises");
  try {
    await unlink(TOKEN_FILE);
  } catch {
    // token file may not exist
  }
}
