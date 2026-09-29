import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AgroGPSClient, FinanceScope } from "../client/agrogps-api.js";
import { READ_ONLY, handleToolError, json } from "./shared.js";

const scopeShape = {
  farm_id: z.string().uuid().optional().describe("Farm id (from list_farms). Omit to use group_id"),
  group_id: z.string().uuid().optional().describe("Group id (from list_groups) for figures consolidated across its farms"),
};

const campaign = z
  .string()
  .regex(/^\d{4}$/)
  .optional()
  .describe("Campaign as its starting year (a campaign runs from 1 September to 31 August). Default: current");

function scopeOf(args: { farm_id?: string; group_id?: string }): FinanceScope {
  return { farm_id: args.farm_id, group_id: args.group_id };
}

export function registerFinanceTools(server: McpServer, client: AgroGPSClient): void {
  server.registerTool(
    "finance_dashboard",
    {
      title: "Manager dashboard",
      description:
        "Money of a farm or a whole group for one campaign: month-by-month cost and income, cost by category " +
        "(phyto, fertiliser, fuel, labour, machinery, seed, insurance, other), cost per hour per worker and per " +
        "machine, margin per hectare per parcel and per crop, per-farm totals and KPIs of the last three campaigns. " +
        "Amounts are integer euro cents.",
      annotations: READ_ONLY,
      inputSchema: { ...scopeShape, campaign, crop: z.string().optional().describe("Only this crop code") },
    },
    async (args) => {
      try {
        return json(await client.financeDashboard(scopeOf(args), args.campaign, args.crop));
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "budget_variance",
    {
      title: "Budget vs actual",
      description:
        "Budget lines (campaign x farm x crop x category) with actual spend, remaining, used percentage and status " +
        "ok / warning (90%+) / over. Amounts in euro cents.",
      annotations: READ_ONLY,
      inputSchema: { ...scopeShape, campaign },
    },
    async (args) => {
      try {
        return json(await client.budgets(scopeOf(args), args.campaign));
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "campaign_forecast",
    {
      title: "Campaign close forecast",
      description:
        "ESTIMATE of how the campaign closes per crop: expected yield x price minus costs already imputed and the " +
        "budget still pending, as a low / mid / high range, total and per hectare. Says whether each assumption " +
        "was saved by the farm, taken from last campaign or is missing. Always present it as an estimate.",
      annotations: READ_ONLY,
      inputSchema: { farm_id: z.string().uuid().describe("Farm id"), campaign },
    },
    async ({ farm_id, campaign: c }) => {
      try {
        return json(await client.forecast(farm_id, c));
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "treasury_dues",
    {
      title: "Receivables and payables",
      description:
        "Money to collect (receivable) and to pay (payable) with issue date, due date, paid date, status " +
        "(open / overdue / paid) and days overdue, plus totals.",
      annotations: READ_ONLY,
      inputSchema: {
        ...scopeShape,
        status: z.enum(["open", "overdue", "paid", "all"]).optional(),
        direction: z.enum(["receivable", "payable"]).optional(),
      },
    },
    async (args) => {
      try {
        return json(await client.dues(scopeOf(args), args.status, args.direction));
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "cash_flow",
    {
      title: "Cash-flow forecast",
      description:
        "Expected cash in and out by week or month from open receivables and payables, starting from the last " +
        "imported bank balance, with overdue amounts apart.",
      annotations: READ_ONLY,
      inputSchema: {
        ...scopeShape,
        granularity: z.enum(["week", "month"]).optional(),
        horizon: z.number().int().min(1).max(52).optional().describe("Number of weeks or months"),
      },
    },
    async (args) => {
      try {
        return json(await client.cashFlow(scopeOf(args), args.granularity, args.horizon));
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "bank_movements",
    {
      title: "Bank movements",
      description:
        "Imported bank accounts with their last balance and movements, what each one was matched to and, for the " +
        "unmatched ones, the best candidates with a score.",
      annotations: READ_ONLY,
      inputSchema: { ...scopeShape, only_open: z.boolean().optional().describe("Only unmatched movements") },
    },
    async (args) => {
      try {
        return json(await client.bankMovements(scopeOf(args), args.only_open ?? false));
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
