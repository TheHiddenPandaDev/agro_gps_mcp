import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { AgroGPSClient } from "../src/client/agrogps-api.js";
import { DEFAULT_API_URL, DEFAULT_TIMEOUT_MS, createServer, loadConfig } from "../src/server.js";
import { MISSING_KEY_MESSAGE } from "../src/tools/shared.js";
import { SERVER_NAME, SERVER_VERSION, USER_AGENT } from "../src/version.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const serverJson = JSON.parse(readFileSync(new URL("../server.json", import.meta.url), "utf8"));
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

const config = { apiKey: "agk_test", apiUrl: "https://api.example/api/v1", timeout: 1000 };

type ToolResult = { isError?: boolean; content: { text: string }[] };
type RegisteredTool = {
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
};

const PUBLIC_TOOLS = ["search_plant_protection_products", "check_plant_protection_product"];

function registeredTools(serverConfig: typeof config | { apiUrl: string; timeout: number } = config) {
  const fetchImpl = vi.fn() as unknown as typeof fetch;
  const server = createServer(serverConfig, new AgroGPSClient(serverConfig, fetchImpl));
  return {
    fetchImpl: fetchImpl as unknown as ReturnType<typeof vi.fn>,
    tools: (server as unknown as { _registeredTools: Record<string, RegisteredTool> })._registeredTools,
  };
}

describe("loadConfig", () => {
  it("reads the key and applies production defaults", () => {
    expect(loadConfig({ AGROGPS_API_KEY: "agk_abc" })).toEqual({
      apiKey: "agk_abc",
      apiUrl: DEFAULT_API_URL,
      timeout: DEFAULT_TIMEOUT_MS,
    });
  });

  it("honours url and timeout overrides", () => {
    const env = {
      AGROGPS_API_KEY: "agk_abc",
      AGROGPS_API_URL: "http://localhost:8080/api/v1",
      AGROGPS_TIMEOUT_MS: "5000",
    };

    expect(loadConfig(env)).toMatchObject({ apiUrl: "http://localhost:8080/api/v1", timeout: 5000 });
  });

  it.each(["soon", "0", "-5", ""])("falls back to the default timeout for %j", (raw) => {
    expect(loadConfig({ AGROGPS_API_KEY: "agk_abc", AGROGPS_TIMEOUT_MS: raw }).timeout).toBe(DEFAULT_TIMEOUT_MS);
  });

  it("ignores an empty api url", () => {
    expect(loadConfig({ AGROGPS_API_KEY: "agk_abc", AGROGPS_API_URL: "" }).apiUrl).toBe(DEFAULT_API_URL);
  });

  it.each([undefined, "", "   "])("starts without a key (%j) instead of failing", (key) => {
    expect(loadConfig({ AGROGPS_API_KEY: key })).toEqual({
      apiKey: undefined,
      apiUrl: DEFAULT_API_URL,
      timeout: DEFAULT_TIMEOUT_MS,
    });
  });

  it("trims whitespace around the key", () => {
    expect(loadConfig({ AGROGPS_API_KEY: "  agk_abc\n" }).apiKey).toBe("agk_abc");
  });

  it("points at the production api on the brand domain", () => {
    expect(DEFAULT_API_URL).toBe("https://api.agrogps.eu/api/v1");
  });
});

describe("tool annotations", () => {
  it("marks every tool except record_entry as read only", () => {
    const { tools } = registeredTools();
    const names = Object.keys(tools);

    expect(names).toHaveLength(16);
    expect(names.slice(0, 2)).toEqual(PUBLIC_TOOLS);
    for (const name of names.filter((n) => n !== "record_entry")) {
      expect(tools[name].annotations?.readOnlyHint, name).toBe(true);
    }
  });

  it("declares record_entry as a non destructive write", () => {
    const annotations = registeredTools().tools.record_entry.annotations;

    expect(annotations?.readOnlyHint).toBe(false);
    expect(annotations?.destructiveHint).toBe(false);
  });

  it("documents every registered tool in the README", () => {
    for (const name of Object.keys(registeredTools().tools)) {
      expect(readme, name).toContain(`\`${name}\``);
    }
  });
});

describe("without an api key", () => {
  const keyless = { apiUrl: "https://api.example/api/v1", timeout: 1000 };

  it("still lists every tool", () => {
    expect(Object.keys(registeredTools(keyless).tools)).toHaveLength(16);
  });

  it.each([
    ["list_farms", {}],
    ["finance_dashboard", {}],
    ["record_entry", {
      farm_id: "0b5f7a1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b", parcel_refcat: "x", entry_type: "treatment", title: "t",
      event_at: "2026-09-20T09:00:00+02:00",
    }],
  ])("answers %s with where to create a key and never calls the api", async (name, args) => {
    const { tools, fetchImpl } = registeredTools(keyless);

    const result = await tools[name].handler(args);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe(MISSING_KEY_MESSAGE);
    expect(result.content[0].text).toContain("https://agrogps.eu/app/");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("release metadata", () => {
  it("keeps package.json, server.json and the runtime version in step", () => {
    expect(pkg.name).toBe(SERVER_NAME);
    expect(pkg.version).toBe(SERVER_VERSION);
    expect(serverJson.version).toBe(SERVER_VERSION);
    expect(serverJson.packages[0].identifier).toBe(pkg.name);
    expect(serverJson.packages[0].version).toBe(SERVER_VERSION);
    expect(USER_AGENT).toBe(`${SERVER_NAME}/${SERVER_VERSION}`);
  });

  it("uses the same registry name in package.json, server.json and the README", () => {
    expect(pkg.mcpName).toBe(serverJson.name);
    expect(readme).toContain(`mcp-name: ${pkg.mcpName}`);
  });

  it("stays within the registry description limit", () => {
    expect(serverJson.description.length).toBeLessThanOrEqual(100);
  });

  it("ships only the build, readme, licence and server.json", () => {
    expect(pkg.files).toEqual(["build/**/*.js", "build/**/*.d.ts", "README.md", "LICENSE", "server.json"]);
    expect(pkg.bin[SERVER_NAME]).toBe("./build/index.js");
  });

  it("advertises the same default api url in server.json", () => {
    const url = serverJson.packages[0].environmentVariables.find((v: { name: string }) => v.name === "AGROGPS_API_URL");
    expect(url.default).toBe(DEFAULT_API_URL);
  });
});
