import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AgroGPSClient } from "../client/agrogps-api.js";
import { READ_ONLY, handleToolError, json } from "./shared.js";

export function registerFarmTools(server: McpServer, client: AgroGPSClient): void {
  server.registerTool(
    "list_farms",
    {
      title: "List farms",
      description:
        "Farms (explotaciones) the API key can see, with the key owner's role in each, the plan and whether the " +
        "holder data required for official submissions is complete. Call this first to get farm ids.",
      annotations: READ_ONLY,
      inputSchema: {},
    },
    async () => {
      try {
        return json(await client.listFarms());
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "list_entries",
    {
      title: "List notebook entries",
      description:
        "Field notebook entries (labores) of a farm: treatments, fertilising, irrigation, sowing, harvest, expenses… " +
        "with the compliance fields (Anexo II). Paginated: pass `since` = the `next` cursor of the previous page. " +
        "Deleted entries come back with deleted=true so a mirror can stay in sync.",
      annotations: READ_ONLY,
      inputSchema: {
        farm_id: z.string().uuid().describe("Farm id from list_farms"),
        since: z.number().int().min(0).default(0).describe("Change cursor; 0 for the full notebook"),
      },
    },
    async ({ farm_id, since }) => {
      try {
        return json(await client.listEntries(farm_id, since));
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "entry_history",
    {
      title: "Entry history",
      description: "Who created, edited or deleted a notebook entry and when, field by field (audit trail).",
      annotations: READ_ONLY,
      inputSchema: { entry_id: z.string().uuid().describe("Entry id") },
    },
    async ({ entry_id }) => {
      try {
        return json(await client.entryHistory(entry_id));
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
