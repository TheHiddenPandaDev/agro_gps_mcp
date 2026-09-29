import type { EntriesPage, Entry, Farm, GroupItem, PushResult, ServerConfig } from "../types/index.js";
import { AgroGPSApiError, requestJson } from "./http.js";

export interface FinanceScope {
  farm_id?: string;
  group_id?: string;
}

function withScope(scope: FinanceScope, extra: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...scope, ...extra })) {
    if (value !== undefined && value !== "") out[key] = value;
  }
  return out;
}

export { AgroGPSApiError } from "./http.js";

export const MISSING_KEY_CODE = "NO_KEY";

export class AgroGPSClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: ServerConfig, private readonly fetchImpl: typeof fetch = fetch) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.apiUrl.replace(/\/$/, "");
    this.timeout = config.timeout;
  }

  private request<T>(
    method: "GET" | "POST",
    path: string,
    params?: Record<string, string>,
    body?: unknown,
  ): Promise<T> {
    if (!this.apiKey) {
      return Promise.reject(new AgroGPSApiError(MISSING_KEY_CODE, "This tool needs an Agro GPS API key", 401));
    }
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
    return requestJson<T>(this.fetchImpl, {
      method,
      url,
      headers: { "X-API-Key": this.apiKey },
      body,
      timeout: this.timeout,
    });
  }

  listFarms(): Promise<Farm[]> {
    return this.request<Farm[]>("GET", "/farms");
  }

  listEntries(farmId: string, since = 0): Promise<EntriesPage> {
    return this.request<EntriesPage>("GET", "/sync/entries", { farm_id: farmId, since: String(since) });
  }

  entryHistory(entryId: string): Promise<unknown[]> {
    return this.request<unknown[]>("GET", `/notebook/entries/${entryId}/history`);
  }

  listGroups(): Promise<{ groups: GroupItem[] }> {
    return this.request<{ groups: GroupItem[] }>("GET", "/groups");
  }

  groupOverview(groupId: string): Promise<unknown> {
    return this.request<unknown>("GET", `/groups/${groupId}/overview`);
  }

  advisorPortfolio(): Promise<unknown> {
    return this.request<unknown>("GET", "/advisor/portfolio");
  }

  advisorPending(farmId: string): Promise<unknown> {
    return this.request<unknown>("GET", `/advisor/farms/${farmId}/pending`);
  }

  financeDashboard(scope: FinanceScope, campaign?: string, crop?: string): Promise<unknown> {
    return this.request<unknown>("GET", "/finance/dashboard", withScope(scope, { campaign, crop }));
  }

  budgets(scope: FinanceScope, campaign?: string): Promise<unknown> {
    return this.request<unknown>("GET", "/finance/budgets", withScope(scope, { campaign }));
  }

  forecast(farmId: string, campaign?: string): Promise<unknown> {
    return this.request<unknown>("GET", "/finance/forecast", withScope({ farm_id: farmId }, { campaign }));
  }

  dues(scope: FinanceScope, status?: string, direction?: string): Promise<unknown> {
    return this.request<unknown>("GET", "/finance/dues", withScope(scope, { status, direction }));
  }

  cashFlow(scope: FinanceScope, granularity?: string, horizon?: number): Promise<unknown> {
    return this.request<unknown>("GET", "/finance/cashflow",
      withScope(scope, { granularity, horizon: horizon === undefined ? undefined : String(horizon) }));
  }

  bankMovements(scope: FinanceScope, onlyOpen = false): Promise<unknown> {
    return this.request<unknown>("GET", "/finance/bank", withScope(scope, { open: onlyOpen ? "1" : undefined }));
  }

  pushEntries(farmId: string, entries: Partial<Entry>[]): Promise<{ farm_id: string; results: PushResult[] }> {
    return this.request("POST", "/sync/entries", undefined, { farm_id: farmId, entries });
  }
}
