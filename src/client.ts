import { WHOOP_DEVELOPER_API_BASE } from "./config.js";
import { getValidAccessToken, refreshTokens } from "./auth.js";
import type { PaginationParams } from "./types.js";

function buildQuery(params?: Record<string, string | number | string[] | undefined>): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, item);
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

async function whoopFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const makeRequest = async (token: string) => {
    const url = `${WHOOP_DEVELOPER_API_BASE}${path}`;
    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...options.headers,
      },
    });
  };

  let token = await getValidAccessToken();
  let response = await makeRequest(token);

  if (response.status === 401) {
    const refreshed = await refreshTokens();
    token = refreshed.access_token;
    response = await makeRequest(token);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WHOOP API error ${response.status} on ${path}: ${body}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export const whoopClient = {
  getProfile: () => whoopFetch("/v2/user/profile/basic"),
  getBodyMeasurements: () => whoopFetch("/v2/user/measurement/body"),
  revokeAccess: () => whoopFetch("/v2/user/access", { method: "DELETE" }),

  listCycles: (params?: PaginationParams) =>
    whoopFetch(`/v2/cycle${buildQuery(params as Record<string, string | number | undefined>)}`),
  getCycle: (cycleId: number) => whoopFetch(`/v2/cycle/${cycleId}`),
  getSleepForCycle: (cycleId: number) => whoopFetch(`/v2/cycle/${cycleId}/sleep`),

  listRecoveries: (params?: PaginationParams) =>
    whoopFetch(`/v2/recovery${buildQuery(params as Record<string, string | number | undefined>)}`),
  getRecoveryForCycle: (cycleId: number) => whoopFetch(`/v2/cycle/${cycleId}/recovery`),

  listSleeps: (params?: PaginationParams) =>
    whoopFetch(`/v2/activity/sleep${buildQuery(params as Record<string, string | number | undefined>)}`),
  getSleep: (sleepId: string) => whoopFetch(`/v2/activity/sleep/${sleepId}`),
  getSleepStream: (sleepId: string, types?: string[]) =>
    whoopFetch(`/v2/activity/sleep/${sleepId}/stream${buildQuery({ types })}`),

  listWorkouts: (params?: PaginationParams) =>
    whoopFetch(`/v2/activity/workout${buildQuery(params as Record<string, string | number | undefined>)}`),
  getWorkout: (workoutId: string) => whoopFetch(`/v2/activity/workout/${workoutId}`),

  getActivityIdMapping: (activityV1Id: number) =>
    whoopFetch(`/v1/activity-mapping/${activityV1Id}`),

  async fetchAllPages<T>(
    fetchPage: (params: PaginationParams) => Promise<{ records: T[]; next_token?: string }>,
    params: PaginationParams = {},
    maxPages = 20,
  ): Promise<T[]> {
    const all: T[] = [];
    let nextToken = params.nextToken;

    for (let page = 0; page < maxPages; page++) {
      const result = await fetchPage({ ...params, nextToken });
      all.push(...result.records);
      if (!result.next_token) break;
      nextToken = result.next_token;
    }

    return all;
  },
};

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
