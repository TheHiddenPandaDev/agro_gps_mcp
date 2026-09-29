import { describe, expect, it, vi } from "vitest";
import { AgroGPSPublicClient } from "../src/client/public-api.js";
import { AgroGPSClient } from "../src/client/agrogps-api.js";
import { createServer } from "../src/server.js";

const config = { apiUrl: "https://api.example/api/v1", timeout: 1000 };

type ToolResult = { isError?: boolean; content: { text: string }[] };
type Handler = (args: Record<string, unknown>) => Promise<ToolResult>;
type Registered = { handler: Handler; inputSchema: { parse: (args: unknown) => Record<string, unknown> } };

function reply(status: number, body: unknown) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: "x",
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch;
}

function tools(fetchImpl: typeof fetch, timeout = config.timeout) {
  const withTimeout = { ...config, timeout };
  const server = createServer(withTimeout, new AgroGPSClient(withTimeout, reply(500, {})),
    new AgroGPSPublicClient(withTimeout, fetchImpl));
  const registered = (server as unknown as { _registeredTools: Record<string, Registered> })._registeredTools;
  const validated = (tool: Registered): Handler => (args) => tool.handler(tool.inputSchema.parse(args));
  return {
    search: validated(registered.search_plant_protection_products),
    check: validated(registered.check_plant_protection_product),
  };
}

function calls(fetchImpl: typeof fetch) {
  return (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls as [URL, RequestInit][];
}

function body(result: ToolResult) {
  return JSON.parse(result.content[0].text);
}

describe("search_plant_protection_products", () => {
  it("queries the public register without a key and links each product to its page", async () => {
    const fetchImpl = reply(200, {
      success: true,
      data: {
        matches: [
          { registration_number: "ES-00725", name: "ROUNDUP ULTRA PLUS", status: "Vigente",
            authorisation: { state: "authorised", level: "green" } },
          { registration_number: "ES-99999", name: "NOT ON THE SITE", status: "Cancelado" },
        ],
      },
    });

    const result = body(await tools(fetchImpl).search({ q: "roundup", country: "ES" }));

    const [url, init] = calls(fetchImpl)[0];
    expect(String(url)).toBe("https://api.example/api/public/phyto/?q=roundup&country=ES");
    expect(init.method).toBe("GET");
    expect(init.headers).not.toHaveProperty("X-API-Key");
    expect(result.matches[0].page_url)
      .toBe("https://agrogps.eu/plazos/producto/ES-00725-roundup-ultra-plus/?utm_source=mcp");
    expect(result.matches[1].page_url).toBe("https://agrogps.eu/plazos/producto/?utm_source=mcp");
    expect(result.more).toBe("https://agrogps.eu/plazos/producto/?utm_source=mcp");
    expect(result.note).toBeUndefined();
  });

  it("builds the page of a German product with its registration in the slug", async () => {
    const fetchImpl = reply(200, { data: { matches: [{ registration_number: "004329-00", name: "Domark 10 EC" }] } });

    const result = body(await tools(fetchImpl).search({ q: "domark", country: "DE" }));

    expect(result.matches[0].page_url).toBe("https://agrogps.eu/de/wartezeit/domark-10-ec-004329-00/?utm_source=mcp");
  });

  it("explains an empty result and points to the country page", async () => {
    const result = body(await tools(reply(200, { data: { matches: [] } })).search({ q: "zzzzz", country: "it" }));

    expect(result.country).toBe("IT");
    expect(result.matches).toEqual([]);
    expect(result.note).toContain("No product matches");
    expect(result.more).toBe("https://agrogps.eu/it/strumenti/?utm_source=mcp");
  });

  it("sends an unsupported country through and answers with the empty note", async () => {
    const fetchImpl = reply(200, { data: { matches: [] } });

    const result = body(await tools(fetchImpl).search({ q: "roundup", country: "US" }));

    expect(String(calls(fetchImpl)[0][0])).toContain("country=US");
    expect(result.note).toBeDefined();
    expect(result.more).toBe("https://agrogps.eu/en/tools/?utm_source=mcp");
  });

  it("tolerates a response without matches", async () => {
    const result = body(await tools(reply(200, { data: {} })).search({ q: "roundup", country: "FR" }));

    expect(result.matches).toEqual([]);
  });

  it("turns the per-IP rate limit into a wait-and-retry message", async () => {
    const result = await tools(reply(429, { code: "AUT_429", message: "Demasiados intentos" }))
      .search({ q: "roundup", country: "ES" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("rate limit");
  });

  it("reports a timeout instead of hanging", async () => {
    const hanging = vi.fn((_url: URL, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })) as unknown as typeof fetch;

    const result = await tools(hanging, 20).search({ q: "roundup", country: "ES" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("within 20 ms");
  });

  it("reports a network failure", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    const result = await tools(offline).search({ q: "roundup", country: "ES" });

    expect(result.content[0].text).toContain("Could not reach Agro GPS: fetch failed");
  });
});

describe("check_plant_protection_product", () => {
  it("looks a product up with the crop and links the register it came from", async () => {
    const fetchImpl = reply(200, {
      data: { registration_number: "ES-00725", name: "ROUNDUP ULTRA PLUS", register_country: "ES",
        crop_check: { crop: "OLVEU", state: "authorised" } },
    });

    const result = body(await tools(fetchImpl).check({ registration: "ES-00725", country: "AD", crop_eppo: "OLVEU" }));

    expect(String(calls(fetchImpl)[0][0]))
      .toBe("https://api.example/api/public/phyto/ES-00725?country=AD&crop=OLVEU");
    expect(result.crop_check.state).toBe("authorised");
    expect(result.page_url).toBe("https://agrogps.eu/plazos/producto/ES-00725-roundup-ultra-plus/?utm_source=mcp");
  });

  it("escapes registration numbers that carry slashes or spaces", async () => {
    const fetchImpl = reply(200, { data: { registration_number: "12/34 A", name: "X" } });

    await tools(fetchImpl).check({ registration: "12/34 A", country: "PL" });

    expect(String(calls(fetchImpl)[0][0])).toBe("https://api.example/api/public/phyto/12%2F34%20A?country=PL");
  });

  it("omits the crop when not given", async () => {
    const fetchImpl = reply(200, { data: { registration_number: "7400057", name: "ROUNDUP", register_country: "FR" } });

    const result = body(await tools(fetchImpl).check({ registration: "7400057", country: "FR" }));

    expect(String(calls(fetchImpl)[0][0])).toBe("https://api.example/api/public/phyto/7400057?country=FR");
    expect(result.page_url).toBe("https://agrogps.eu/fr/delai-avant-recolte/?utm_source=mcp");
  });

  it("says when the registration number does not exist", async () => {
    const notFound = { code: "FIT_404", message: "No hay ningún producto con ese número de registro" };
    const result = await tools(reply(404, notFound))
      .check({ registration: "0000", country: "ES" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("FIT_404");
  });

  it("says when the country's register is not mirrored", async () => {
    const result = await tools(reply(404, { code: "FIT_405", message: "Todavía no tenemos el registro" }))
      .check({ registration: "123", country: "US" });

    expect(result.content[0].text).toContain("FIT_405");
    expect(result.content[0].text).not.toContain("AGROGPS_API_KEY");
  });

  it("passes the crop code validation error through", async () => {
    const result = await tools(reply(400, { code: "FIT_003", message: "El código de cultivo no es un código EPPO" }))
      .check({ registration: "ES-00725", country: "ES", crop_eppo: "XXXXX" });

    expect(result.content[0].text).toContain("FIT_003");
  });
});

describe("input validation", () => {
  it.each([
    [{ q: "ro", country: "ES" }],
    [{ q: "roundup", country: "ESP" }],
    [{ q: "roundup", country: "1" }],
    [{ q: "roundup" }],
  ])("rejects %j before calling the api", (args) => {
    const fetchImpl = reply(200, {});

    expect(() => tools(fetchImpl).search(args)).toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("normalises the country and the crop code", async () => {
    const fetchImpl = reply(200, { data: { registration_number: "1", name: "X" } });

    await tools(fetchImpl).check({ registration: " 1 ", country: " fr ", crop_eppo: "vitvi" });

    expect(String(calls(fetchImpl)[0][0])).toBe("https://api.example/api/public/phyto/1?country=FR&crop=VITVI");
  });
});

describe("public client", () => {
  it("derives the public endpoint from the api origin", () => {
    const fetchImpl = reply(200, { data: { matches: [] } });
    const client = new AgroGPSPublicClient({ apiUrl: "http://localhost:8080/api/v1/", timeout: 1000 }, fetchImpl);

    return client.searchProducts("abc", "ES").then(() => {
      expect(String(calls(fetchImpl)[0][0])).toBe("http://localhost:8080/api/public/phyto/?q=abc&country=ES");
    });
  });
});
