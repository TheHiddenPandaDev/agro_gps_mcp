import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AgroGPSClient } from "../client/agrogps-api.js";
import { READ_ONLY, handleToolError, json } from "./shared.js";

export function registerGroupTools(server: McpServer, client: AgroGPSClient): void {
  server.registerTool(
    "list_groups",
    {
      title: "List farm groups",
      description: "Groups (a company or cooperative holding several farms) the key owner belongs to, with their role.",
      annotations: READ_ONLY,
      inputSchema: {},
    },
    async () => {
      try {
        return json(await client.listGroups());
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "group_overview",
    {
      title: "Group overview",
      description:
        "Consolidated panel of a group: per farm, entries, cost, income, margin, treated hectares, compliance light " +
        "(green/amber/red), pending review counts and a breakdown by crop; plus totals.",
      annotations: READ_ONLY,
      inputSchema: { group_id: z.string().uuid().describe("Group id from list_groups") },
    },
    async ({ group_id }) => {
      try {
        return json(await client.groupOverview(group_id));
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "advisor_portfolio",
    {
      title: "Advisor portfolio",
      description:
        "For advisors and owners: every farm they can review, with entries, missing compliance fields, pending, " +
        "flagged and approved counts and a traffic light.",
      annotations: READ_ONLY,
      inputSchema: {},
    },
    async () => {
      try {
        return json(await client.advisorPortfolio());
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "advisor_pending",
    {
      title: "Advisor pending queue",
      description: "Entries of a farm that still need review or lack mandatory fields, with the list of missing fields.",
      annotations: READ_ONLY,
      inputSchema: { farm_id: z.string().uuid().describe("Farm id") },
    },
    async ({ farm_id }) => {
      try {
        return json(await client.advisorPending(farm_id));
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
