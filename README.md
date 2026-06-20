# WHOOP MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server that connects Claude, Cursor, and other MCP clients to your [WHOOP](https://www.whoop.com/) health data via the official WHOOP v2 API.

Ask questions like *"What's my recovery score today?"*, *"How did I sleep this week?"*, or *"Show my workouts from the last month"* — all through natural conversation.

## Features

- Full coverage of WHOOP v2 read endpoints (profile, body measurements, cycles, recovery, sleep, workouts)
- OAuth 2.0 with automatic token refresh
- Local token storage (`~/.whoop-mcp/tokens.json`, mode 600)
- Pagination support and bulk fetch for date ranges
- Sleep stream data (HR, skin temp, sleep classification)
- MCP resource with API reference docs

## Prerequisites

1. An active WHOOP membership
2. A WHOOP developer app — register at [developer.whoop.com](https://developer.whoop.com)
3. Node.js 18+

## Setup

### 1. Create a WHOOP Developer App

1. Go to [developer.whoop.com](https://developer.whoop.com) and sign in
2. Create a new App with these scopes:
   - `offline` (required for refresh tokens)
   - `read:profile`
   - `read:body_measurement`
   - `read:cycles`
   - `read:recovery`
   - `read:sleep`
   - `read:workout`
3. Add redirect URI: `http://localhost:8080/callback`
4. Set **Privacy Policy URL** — see [Privacy policy hosting](#privacy-policy-hosting) below
5. Copy your **Client ID** and **Client Secret**

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your Client ID and Client Secret
```

### 3. Install and authenticate

```bash
npm install
npm run auth
```

This opens your browser for WHOOP authorization and saves tokens locally.

### 4. Add to Cursor

Add to your Cursor MCP config (`~/.cursor/mcp.json` or project settings):

```json
{
  "mcpServers": {
    "whoop": {
      "command": "node",
      "args": ["/Users/benny/Documents/Mcps/whoop mcp/dist/index.js"],
      "env": {
        "WHOOP_CLIENT_ID": "your_client_id",
        "WHOOP_CLIENT_SECRET": "your_client_secret",
        "WHOOP_REDIRECT_URI": "http://localhost:8080/callback"
      }
    }
  }
}
```

Or use `npm run dev` during development:

```json
{
  "mcpServers": {
    "whoop": {
      "command": "npx",
      "args": ["tsx", "/Users/benny/Documents/Mcps/whoop mcp/src/index.ts"],
      "env": {
        "WHOOP_CLIENT_ID": "your_client_id",
        "WHOOP_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

### 5. Add to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "whoop": {
      "command": "node",
      "args": ["/Users/benny/Documents/Mcps/whoop mcp/dist/index.js"],
      "env": {
        "WHOOP_CLIENT_ID": "your_client_id",
        "WHOOP_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `whoop_get_auth_url` | Get OAuth authorization URL |
| `whoop_exchange_code` | Exchange auth code for tokens |
| `whoop_auth_status` | Check authentication status |
| `whoop_revoke_access` | Revoke access and clear tokens |
| `whoop_get_profile` | User name, email, user ID |
| `whoop_get_body_measurements` | Height, weight, max HR |
| `whoop_list_cycles` | Physiological cycles (strain, HR) |
| `whoop_get_cycle` | Single cycle by ID |
| `whoop_get_sleep_for_cycle` | Sleep for a cycle |
| `whoop_list_recoveries` | Recovery scores, HRV, SpO2 |
| `whoop_get_recovery_for_cycle` | Recovery for a cycle |
| `whoop_list_sleeps` | Sleep sessions with stages |
| `whoop_get_sleep` | Single sleep by ID |
| `whoop_get_sleep_stream` | Raw sleep signal data |
| `whoop_list_workouts` | Workouts with strain and zones |
| `whoop_get_workout` | Single workout by ID |
| `whoop_get_activity_id_mapping` | Map v1 activity ID to v2 UUID |
| `whoop_fetch_all` | Bulk fetch all data types for a date range |

## Example Queries

Once connected, try asking your AI assistant:

- "What's my recovery score today?"
- "Show my sleep data from the past 7 days"
- "What workouts did I do this month?"
- "What's my average HRV this week?"
- "Fetch all my WHOOP data from January 2026"

## Security

- Tokens are stored locally at `~/.whoop-mcp/tokens.json` with file permissions 600
- Client secrets should only be set in MCP server env vars, never committed to git
- The server is read-only — it cannot modify your WHOOP data
- Use `whoop_revoke_access` to disconnect

## API Reference

Official docs: [developer.whoop.com/api](https://developer.whoop.com/api/)

The MCP server also exposes a `whoop-api-reference` resource with endpoint documentation.

## Privacy policy hosting

WHOOP requires a **public privacy policy URL** when creating a developer app. This repo includes one at [`docs/privacy-policy.html`](docs/privacy-policy.html) (also available as [`PRIVACY.md`](PRIVACY.md)).

### Option A — GitHub Pages (recommended)

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Source: **Deploy from branch** → `main` → folder **`/docs`**
4. Your URL will be:

```
https://<your-github-username>.github.io/<repo-name>/privacy-policy.html
```

Use that URL in the WHOOP Developer Dashboard.

### Option B — GitHub raw link (quick test)

If the repo is public, you can try the raw file URL:

```
https://raw.githubusercontent.com/<username>/<repo>/main/docs/privacy-policy.html
```

Some dashboards accept this; GitHub Pages is more reliable.

### Option C — Any static host

Upload `docs/privacy-policy.html` to Netlify, Vercel, Cloudflare Pages, or your own site. WHOOP requires an `https://` URL.

## Webhook URL

WHOOP webhooks require a **public HTTPS endpoint** (GitHub Pages will not work). This repo includes a Vercel handler at [`api/webhook.ts`](api/webhook.ts).

### Bootstrap order (webhook before client secret)

You do **not** need the client secret to deploy the webhook or create the WHOOP app. Do it in this order:

| Step | Action |
|------|--------|
| **1** | Deploy to [vercel.com/new](https://vercel.com/new) → import **`32r7ue/whoopmcp`** → **Deploy** (skip env vars for now) |
| **2** | Copy your URL: `https://<project>.vercel.app/api/webhook` |
| **3** | Create the WHOOP app — paste that URL under **Webhooks**, model **V2**, plus your [privacy policy URL](#privacy-policy-hosting) |
| **4** | WHOOP shows **Client ID** + **Client Secret** — copy both |
| **5** | Vercel → Project → **Settings → Environment Variables** → add `WHOOP_CLIENT_SECRET` → **Redeploy** |
| **6** | Local: copy `.env.example` → `.env`, add `WHOOP_CLIENT_ID` and `WHOOP_CLIENT_SECRET`, run `npm run auth` |

The webhook accepts requests in **bootstrap mode** until you add the secret (returns `200` so the dashboard is happy). After step 5, it validates WHOOP signatures properly.

### Deploy to Vercel

1. [vercel.com/new](https://vercel.com/new) → import **`32r7ue/whoopmcp`**
2. Deploy **without** environment variables first (if the app does not exist yet)
3. Webhook URL:

```
https://<your-vercel-project>.vercel.app/api/webhook
```

4. After you have the WHOOP client secret, add **`WHOOP_CLIENT_SECRET`** in Vercel and redeploy

Verify in a browser — you should see:

```json
{"ok":true,"service":"whoop-mcp-webhook","message":"POST WHOOP webhook events to this URL. Model version: v2."}
```

### Where to find Client ID & Secret

After saving the WHOOP app: **Developer Dashboard → your app → Client ID** (visible) and **Client Secret** (Show/Reveal, or regenerate if lost).

### Local testing (optional)

Use [ngrok](https://ngrok.com) to expose a local server:

```bash
npx tsx webhook/local-server.ts
ngrok http 3000
```

Use the ngrok HTTPS URL + `/webhook` in the dashboard while testing.

## License

MIT
