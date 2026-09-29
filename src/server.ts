import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AgroGPSClient } from "./client/agrogps-api.js";
import { AgroGPSPublicClient } from "./client/public-api.js";
import { registerFarmTools } from "./tools/farms.js";
import { registerFinanceTools } from "./tools/finance.js";
import { registerGroupTools } from "./tools/groups.js";
import { registerPhytoTools } from "./tools/phyto.js";
import { registerRecordTools } from "./tools/record.js";
import type { ServerConfig } from "./types/index.js";
import { SERVER_NAME, SERVER_VERSION } from "./version.js";

export const DEFAULT_API_URL = "https://api.agrogps.eu/api/v1";
export const DEFAULT_TIMEOUT_MS = 20000;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const apiKey = env.AGROGPS_API_KEY?.trim();
  const timeout = Number.parseInt(env.AGROGPS_TIMEOUT_MS ?? "", 10);
  return {
    apiKey: apiKey || undefined,
    apiUrl: env.AGROGPS_API_URL || DEFAULT_API_URL,
    timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
  };
}

export function createServer(
  config: ServerConfig,
  client: AgroGPSClient = new AgroGPSClient(config),
  publicClient: AgroGPSPublicClient = new AgroGPSPublicClient(config),
): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerPhytoTools(server, publicClient);
  registerFarmTools(server, client);
  registerGroupTools(server, client);
  registerRecordTools(server, client);
  registerFinanceTools(server, client);
  return server;
}
