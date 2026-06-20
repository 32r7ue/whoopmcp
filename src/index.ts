#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  buildAuthUrl,
  exchangeCode,
  getAuthStatus,
  revokeAccess,
} from "./auth.js";
import { formatJson, whoopClient } from "./client.js";

const paginationSchema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .optional()
    .describe("Max records per page (1-25, default 10)"),
  start: z
    .string()
    .optional()
    .describe("ISO 8601 timestamp — return records on or after this time"),
  end: z
    .string()
    .optional()
    .describe("ISO 8601 timestamp — return records before this time"),
  nextToken: z
    .string()
    .optional()
    .describe("Pagination cursor from a previous response"),
};

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: formatJson(data) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

async function safeTool<T>(fn: () => Promise<T>) {
  try {
    return textResult(await fn());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(message);
  }
}

const server = new McpServer({
  name: "whoop-mcp",
  version: "1.0.0",
});

// ── Auth tools ──────────────────────────────────────────────────────────────

server.tool(
  "whoop_get_auth_url",
  "Get the WHOOP OAuth authorization URL. Open it in a browser, authorize, then use whoop_exchange_code with the code from the redirect.",
  {},
  async () => {
    try {
      const { url, state } = buildAuthUrl();
      return textResult({
        authorization_url: url,
        state,
        instructions:
          "1. Open the authorization_url in your browser\n2. Log in and authorize the app\n3. Copy the `code` query param from the redirect URL\n4. Call whoop_exchange_code with that code",
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
);

server.tool(
  "whoop_exchange_code",
  "Exchange a WHOOP OAuth authorization code for access and refresh tokens",
  { code: z.string().describe("Authorization code from the OAuth redirect URL") },
  async ({ code }) =>
    safeTool(async () => {
      const tokens = await exchangeCode(code);
      return {
        success: true,
        scope: tokens.scope,
        expires_at: new Date(tokens.expires_at).toISOString(),
        message: "Authentication successful. Tokens saved locally.",
      };
    }),
);

server.tool(
  "whoop_auth_status",
  "Check whether WHOOP OAuth tokens are stored and valid",
  {},
  async () => safeTool(() => getAuthStatus()),
);

server.tool(
  "whoop_revoke_access",
  "Revoke WHOOP OAuth access and clear local tokens",
  {},
  async () =>
    safeTool(async () => {
      await revokeAccess();
      return { success: true, message: "Access revoked and local tokens cleared." };
    }),
);

// ── Profile & body ──────────────────────────────────────────────────────────

server.tool(
  "whoop_get_profile",
  "Get the authenticated user's basic profile (name, email, user_id)",
  {},
  async () => safeTool(() => whoopClient.getProfile()),
);

server.tool(
  "whoop_get_body_measurements",
  "Get body measurements: height (m), weight (kg), max heart rate",
  {},
  async () => safeTool(() => whoopClient.getBodyMeasurements()),
);

// ── Cycles ──────────────────────────────────────────────────────────────────

server.tool(
  "whoop_list_cycles",
  "List physiological cycles (strain, heart rate, kilojoules). Sorted by start time descending.",
  paginationSchema,
  async (params) => safeTool(() => whoopClient.listCycles(params)),
);

server.tool(
  "whoop_get_cycle",
  "Get a single physiological cycle by ID",
  { cycleId: z.number().int().describe("Cycle ID") },
  async ({ cycleId }) => safeTool(() => whoopClient.getCycle(cycleId)),
);

server.tool(
  "whoop_get_sleep_for_cycle",
  "Get the sleep activity associated with a specific cycle",
  { cycleId: z.number().int().describe("Cycle ID") },
  async ({ cycleId }) => safeTool(() => whoopClient.getSleepForCycle(cycleId)),
);

// ── Recovery ────────────────────────────────────────────────────────────────

server.tool(
  "whoop_list_recoveries",
  "List recovery scores with HRV, resting HR, SpO2, and skin temperature",
  paginationSchema,
  async (params) => safeTool(() => whoopClient.listRecoveries(params)),
);

server.tool(
  "whoop_get_recovery_for_cycle",
  "Get recovery data for a specific cycle",
  { cycleId: z.number().int().describe("Cycle ID") },
  async ({ cycleId }) => safeTool(() => whoopClient.getRecoveryForCycle(cycleId)),
);

// ── Sleep ───────────────────────────────────────────────────────────────────

server.tool(
  "whoop_list_sleeps",
  "List sleep sessions with stages, performance %, efficiency, and respiratory rate",
  paginationSchema,
  async (params) => safeTool(() => whoopClient.listSleeps(params)),
);

server.tool(
  "whoop_get_sleep",
  "Get detailed sleep data for a specific sleep ID",
  { sleepId: z.string().describe("Sleep UUID") },
  async ({ sleepId }) => safeTool(() => whoopClient.getSleep(sleepId)),
);

server.tool(
  "whoop_get_sleep_stream",
  "Get raw signal stream data for a sleep session (HR, skin temp, etc.)",
  {
    sleepId: z.string().describe("Sleep UUID"),
    types: z
      .array(
        z.enum([
          "hr",
          "skin_temp",
          "board_temp",
          "battery_temp",
          "sleep_classification",
          "charging_status",
        ]),
      )
      .optional()
      .describe("Signal types to include (default: all)"),
  },
  async ({ sleepId, types }) => safeTool(() => whoopClient.getSleepStream(sleepId, types)),
);

// ── Workouts ────────────────────────────────────────────────────────────────

server.tool(
  "whoop_list_workouts",
  "List workouts with strain, heart rate zones, distance, and sport name",
  paginationSchema,
  async (params) => safeTool(() => whoopClient.listWorkouts(params)),
);

server.tool(
  "whoop_get_workout",
  "Get detailed workout data for a specific workout ID",
  { workoutId: z.string().describe("Workout UUID") },
  async ({ workoutId }) => safeTool(() => whoopClient.getWorkout(workoutId)),
);

// ── Utility ─────────────────────────────────────────────────────────────────

server.tool(
  "whoop_get_activity_id_mapping",
  "Map a legacy v1 activity ID to its v2 UUID",
  { activityV1Id: z.number().int().describe("Legacy v1 activity ID") },
  async ({ activityV1Id }) => safeTool(() => whoopClient.getActivityIdMapping(activityV1Id)),
);

server.tool(
  "whoop_fetch_all",
  "Fetch all paginated data for a date range across cycles, recoveries, sleeps, and workouts",
  {
    start: z.string().describe("ISO 8601 start timestamp"),
    end: z.string().optional().describe("ISO 8601 end timestamp (default: now)"),
    maxPages: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Max pages per data type (default 10)"),
  },
  async ({ start, end, maxPages = 10 }) =>
    safeTool(async () => {
      const params = { start, end, limit: 25 };
      const [cycles, recoveries, sleeps, workouts] = await Promise.all([
        whoopClient.fetchAllPages(
          (p) => whoopClient.listCycles(p) as Promise<{ records: unknown[]; next_token?: string }>,
          params,
          maxPages,
        ),
        whoopClient.fetchAllPages(
          (p) => whoopClient.listRecoveries(p) as Promise<{ records: unknown[]; next_token?: string }>,
          params,
          maxPages,
        ),
        whoopClient.fetchAllPages(
          (p) => whoopClient.listSleeps(p) as Promise<{ records: unknown[]; next_token?: string }>,
          params,
          maxPages,
        ),
        whoopClient.fetchAllPages(
          (p) => whoopClient.listWorkouts(p) as Promise<{ records: unknown[]; next_token?: string }>,
          params,
          maxPages,
        ),
      ]);

      return {
        date_range: { start, end: end ?? "now" },
        counts: {
          cycles: cycles.length,
          recoveries: recoveries.length,
          sleeps: sleeps.length,
          workouts: workouts.length,
        },
        cycles,
        recoveries,
        sleeps,
        workouts,
      };
    }),
);

// ── Resources ───────────────────────────────────────────────────────────────

server.resource(
  "whoop-api-reference",
  "whoop://docs/api-reference",
  {
    description: "WHOOP v2 API endpoint reference and available scopes",
    mimeType: "text/markdown",
  },
  async () => ({
    contents: [
      {
        uri: "whoop://docs/api-reference",
        mimeType: "text/markdown",
        text: `# WHOOP v2 API Reference

Base URL: https://api.prod.whoop.com

## OAuth Scopes
- \`offline\` — refresh tokens (required for long-lived access)
- \`read:profile\` — name, email
- \`read:body_measurement\` — height, weight, max HR
- \`read:cycles\` — strain, heart rate, kilojoules
- \`read:recovery\` — recovery score, HRV, resting HR, SpO2, skin temp
- \`read:sleep\` — sleep stages, performance, efficiency
- \`read:workout\` — workouts, strain, HR zones, distance

## Endpoints

| Tool | Method | Path |
|------|--------|------|
| whoop_get_profile | GET | /v2/user/profile/basic |
| whoop_get_body_measurements | GET | /v2/user/measurement/body |
| whoop_list_cycles | GET | /v2/cycle |
| whoop_get_cycle | GET | /v2/cycle/{cycleId} |
| whoop_get_sleep_for_cycle | GET | /v2/cycle/{cycleId}/sleep |
| whoop_list_recoveries | GET | /v2/recovery |
| whoop_get_recovery_for_cycle | GET | /v2/cycle/{cycleId}/recovery |
| whoop_list_sleeps | GET | /v2/activity/sleep |
| whoop_get_sleep | GET | /v2/activity/sleep/{sleepId} |
| whoop_get_sleep_stream | GET | /v2/activity/sleep/{sleepId}/stream |
| whoop_list_workouts | GET | /v2/activity/workout |
| whoop_get_workout | GET | /v2/activity/workout/{workoutId} |
| whoop_get_activity_id_mapping | GET | /v1/activity-mapping/{activityV1Id} |

## Pagination
Collection endpoints accept \`limit\` (1-25), \`start\`, \`end\` (ISO 8601), and \`nextToken\`.

Docs: https://developer.whoop.com/api/
`,
      },
    ],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
