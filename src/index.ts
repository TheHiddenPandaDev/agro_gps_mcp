#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, loadConfig } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const server = createServer(config);
  await server.connect(new StdioServerTransport());
  const mode = config.apiKey ? "all tools" : "public tools only (set AGROGPS_API_KEY for your farm data)";
  console.error(`[agro-gps-mcp] running on stdio, ${mode}`);
}

main().catch((error) => {
  console.error(`[agro-gps-mcp] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
