import { describe, expect, it, vi } from "vitest";
import { AgroGPSClient } from "../src/client/agrogps-api.js";
import { createServer } from "../src/server.js";

const config = { apiKey: "agk_test", apiUrl: "https://api.example/api/v1", timeout: 1000 };

function recordingFetch(body: unknown) {
  return vi.fn(async () => ({ ok: true, status: 200, statusText: "OK", text: async () => JSON.stringify(body) })) as unknown as typeof fetch;
}

function urls(fetchImpl: typeof fetch): string[] {
  return (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
}

describe("finance client", () => {
  it("reads every finance resource with GET and only the given scope", async () => {
    const fetchImpl = recordingFetch({ data: {} });
    const client = new AgroGPSClient(config, fetchImpl);

    await client.financeDashboard({ group_id: "g1" }, "2026", "olive");
    await client.budgets({ farm_id: "f1" });
    await client.forecast("f1", "2026");
    await client.dues({ farm_id: "f1" }, "overdue");
    await client.cashFlow({ farm_id: "f1" }, "month", 6);
    await client.bankMovements({ farm_id: "f1" }, true);

    expect(urls(fetchImpl)).toEqual([
      "https://api.example/api/v1/finance/dashboard?group_id=g1&campaign=2026&crop=olive",
      "https://api.example/api/v1/finance/budgets?farm_id=f1",
      "https://api.example/api/v1/finance/forecast?farm_id=f1&campaign=2026",
      "https://api.example/api/v1/finance/dues?farm_id=f1&status=overdue",
      "https://api.example/api/v1/finance/cashflow?farm_id=f1&granularity=month&horizon=6",
      "https://api.example/api/v1/finance/bank?farm_id=f1&open=1",
    ]);
    for (const call of (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls) {
      expect((call[1] as RequestInit).method).toBe("GET");
    }
  });

  it("registers the finance tools", () => {
    const server = createServer(config, new AgroGPSClient(config, recordingFetch({})));
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools;
    for (const name of ["finance_dashboard", "budget_variance", "campaign_forecast", "treasury_dues", "cash_flow",
      "bank_movements"]) {
      expect(tools[name]).toBeDefined();
    }
  });
});
