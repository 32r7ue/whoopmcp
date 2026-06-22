import { mkdir, readFile, writeFile, chmod, unlink } from "node:fs/promises";
import { TOKEN_DIR, TOKEN_FILE } from "./config.js";
import type { TokenData } from "./types.js";

export interface TokenStore {
  load(): Promise<TokenData | null>;
  save(tokens: TokenData): Promise<void>;
  delete(): Promise<void>;
}

async function ensureTokenDir(): Promise<void> {
  await mkdir(TOKEN_DIR, { recursive: true, mode: 0o700 });
}

class FileTokenStore implements TokenStore {
  async load(): Promise<TokenData | null> {
    try {
      const raw = await readFile(TOKEN_FILE, "utf-8");
      return JSON.parse(raw) as TokenData;
    } catch {
      return null;
    }
  }

  async save(tokens: TokenData): Promise<void> {
    await ensureTokenDir();
    await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
    await chmod(TOKEN_FILE, 0o600);
  }

  async delete(): Promise<void> {
    try {
      await unlink(TOKEN_FILE);
    } catch {
      // token file may not exist
    }
  }
}

const TOKENS_KEY = "whoop-mcp:tokens";

async function redisCommand<T = unknown>(command: (string | number)[]): Promise<T> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Upstash Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    );
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    throw new Error(`Redis request failed (${response.status})`);
  }

  const data = (await response.json()) as { result?: T; error?: string };
  if (data.error) {
    throw new Error(`Redis error: ${data.error}`);
  }

  return data.result as T;
}

class RedisTokenStore implements TokenStore {
  async load(): Promise<TokenData | null> {
    const raw = await redisCommand<string | null>(["GET", TOKENS_KEY]);
    if (!raw) return null;
    return JSON.parse(raw) as TokenData;
  }

  async save(tokens: TokenData): Promise<void> {
    await redisCommand(["SET", TOKENS_KEY, JSON.stringify(tokens)]);
  }

  async delete(): Promise<void> {
    await redisCommand(["DEL", TOKENS_KEY]);
  }
}

export function getTokenStoreKind(): "file" | "redis" {
  if (process.env.TOKEN_STORE === "redis") return "redis";
  if (process.env.TOKEN_STORE === "file") return "file";
  if (process.env.UPSTASH_REDIS_REST_URL) return "redis";
  return "file";
}

let store: TokenStore | null = null;

export function getTokenStore(): TokenStore {
  if (!store) {
    store = getTokenStoreKind() === "redis" ? new RedisTokenStore() : new FileTokenStore();
  }
  return store;
}

const OAUTH_STATE_PREFIX = "whoop-mcp:oauth-state:";
const OAUTH_STATE_TTL_SECONDS = 600;

export async function saveOAuthState(state: string): Promise<void> {
  if (getTokenStoreKind() !== "redis") {
    throw new Error("OAuth web flow requires Redis (UPSTASH_REDIS_REST_URL).");
  }
  await redisCommand([
    "SET",
    `${OAUTH_STATE_PREFIX}${state}`,
    "1",
    "EX",
    OAUTH_STATE_TTL_SECONDS,
  ]);
}

export async function consumeOAuthState(state: string): Promise<boolean> {
  if (getTokenStoreKind() !== "redis") {
    throw new Error("OAuth web flow requires Redis (UPSTASH_REDIS_REST_URL).");
  }
  const key = `${OAUTH_STATE_PREFIX}${state}`;
  const deleted = await redisCommand<number>(["DEL", key]);
  return deleted > 0;
}
