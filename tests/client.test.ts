import { describe, expect, it, vi } from "vitest";
import { AgroGPSApiError, AgroGPSClient } from "../src/client/agrogps-api.js";

const config = { apiKey: "agk_test", apiUrl: "https://api.example/api/v1", timeout: 1000 };

function fetchReturning(status: number, body: unknown) {
  return vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: "x",
    text: async () => JSON.stringify(body),
    _url: url,
    _init: init,
  })) as unknown as typeof fetch;
}

describe("AgroGPSClient", () => {
  it("sends the api key and unwraps the data envelope", async () => {
    const fetchImpl = fetchReturning(200, { success: true, data: [{ id: "f1", name: "Cerro" }] });
    const client = new AgroGPSClient(config, fetchImpl);

    const farms = await client.listFarms();

    expect(farms).toEqual([{ id: "f1", name: "Cerro" }]);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toBe("https://api.example/api/v1/farms");
    expect((init as RequestInit).headers).toMatchObject({ "X-API-Key": "agk_test" });
  });

  it("passes the pagination cursor and posts entries as json", async () => {
    const fetchImpl = fetchReturning(200, { data: { farm_id: "f1", entries: [], next: 7, has_more: false } });
    const client = new AgroGPSClient(config, fetchImpl);

    await client.listEntries("f1", 42);
    await client.pushEntries("f1", [{ id: "e1" }]);

    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(String(calls[0][0])).toContain("since=42");
    expect((calls[1][1] as RequestInit).method).toBe("POST");
    expect(JSON.parse((calls[1][1] as RequestInit).body as string)).toEqual({ farm_id: "f1", entries: [{ id: "e1" }] });
  });

  it("surfaces api error codes", async () => {
    const client = new AgroGPSClient(config, fetchReturning(403, { code: "AUT_004", message: "solo lectura" }));

    await expect(client.pushEntries("f1", [])).rejects.toMatchObject<Partial<AgroGPSApiError>>({ code: "AUT_004", status: 403 });
  });
});
