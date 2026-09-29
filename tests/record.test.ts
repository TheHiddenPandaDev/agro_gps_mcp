import { describe, expect, it, vi } from "vitest";
import { AgroGPSClient } from "../src/client/agrogps-api.js";
import { createServer } from "../src/server.js";

const config = { apiKey: "agk_test", apiUrl: "https://api.example/api/v1", timeout: 1000 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type Handler = (args: Record<string, unknown>) => Promise<{ isError?: boolean; content: { text: string }[] }>;

function recordEntry(status: number, body: unknown) {
  const fetchImpl = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: "x",
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch;
  const server = createServer(config, new AgroGPSClient(config, fetchImpl));
  const tools = (server as unknown as { _registeredTools: Record<string, { handler: Handler }> })._registeredTools;
  return { handler: tools.record_entry.handler, fetchImpl: fetchImpl as unknown as ReturnType<typeof vi.fn> };
}

const input = {
  farm_id: "0b5f7a1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b",
  parcel_refcat: "14900A11109000",
  entry_type: "treatment",
  title: "Tratamiento · Azufre mojable",
  event_at: "2026-09-20T09:00:00+02:00",
  product_name: "Azufre mojable",
  treated_area_ha: 2.5,
};

describe("record_entry", () => {
  it("always creates a brand new live entry and never deletes or overwrites", async () => {
    const { handler, fetchImpl } = recordEntry(200, { data: { farm_id: input.farm_id, results: [] } });

    await handler(input);
    await handler(input);

    const bodies = fetchImpl.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string));
    const [first, second] = bodies.map((b) => b.entries[0]);
    expect((fetchImpl.mock.calls[0][1] as RequestInit).method).toBe("POST");
    expect(String(fetchImpl.mock.calls[0][0])).toBe("https://api.example/api/v1/sync/entries");
    expect(first.id).toMatch(UUID);
    expect(first.id).not.toBe(second.id);
    expect(first).toMatchObject({ deleted: false, version: 1 });
    expect(first.compliance).toEqual({ product_name: "Azufre mojable", treated_area_ha: 2.5 });
    expect(bodies[0].farm_id).toBe(input.farm_id);
  });

  it("explains a read-only key instead of throwing", async () => {
    const { handler } = recordEntry(403, { code: "AUT_004", message: "Esta clave es de solo lectura" });

    const result = await handler(input);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("AUT_004");
    expect(result.content[0].text).toContain("read-only key");
  });
});
