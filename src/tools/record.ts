import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AgroGPSClient } from "../client/agrogps-api.js";
import { handleToolError, json } from "./shared.js";

const ENTRY_TYPES = [
  "treatment",
  "fertilizing",
  "irrigation",
  "planting",
  "harvest",
  "expense",
  "observation",
  "cultural_work",
] as const;

export function registerRecordTools(server: McpServer, client: AgroGPSClient): void {
  server.registerTool(
    "record_entry",
    {
      title: "Record a notebook entry",
      description:
        "Register a task in the farm's field notebook (needs a key with write scope). The entry is attributed to the " +
        "key owner and marked as written by API in the audit trail; the server stores when it arrived and rejects " +
        "future dates. It only adds new entries: it never edits or deletes existing ones. Confirm the farm, parcel, " +
        "product and date with the user before calling it. Official submission to the administration is never done " +
        "here: it needs a person's session in the app.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      inputSchema: {
        farm_id: z.string().uuid().describe("Farm id from list_farms"),
        parcel_refcat: z.string().min(1).describe("Cadastral reference of the parcel"),
        entry_type: z.enum(ENTRY_TYPES).describe("Kind of task"),
        title: z.string().min(1).max(200).describe("Short title, e.g. 'Tratamiento · Azufre mojable'"),
        event_at: z.string().datetime({ offset: true }).describe("When it happened (ISO 8601 with offset)"),
        product_name: z.string().optional().describe("Product or input used"),
        registration_number: z.string().optional().describe("Official registration number of the product (fito)"),
        quantity: z.number().nonnegative().optional().describe("Quantity applied"),
        unit: z.string().optional().describe("Unit, e.g. 'L/ha', 'kg', 'mm'"),
        treated_area_ha: z.number().nonnegative().optional().describe("Treated area in hectares"),
        cost_cents: z.number().int().nonnegative().optional().describe("Cost in euro cents"),
        safety_days: z.number().int().nonnegative().optional().describe("Pre-harvest interval in days"),
        crop_code: z.string().optional().describe("EPPO crop code, e.g. OLVEU"),
      },
    },
    async (input) => {
      try {
        const entry = {
          id: randomUUID(),
          parcel_refcat: input.parcel_refcat,
          entry_type: input.entry_type,
          title: input.title,
          event_at: input.event_at,
          quantity: input.quantity ?? 0,
          unit: input.unit ?? "",
          cost_cents: input.cost_cents ?? 0,
          price_per_kg_cents: 0,
          registration_number: input.registration_number ?? "",
          safety_days: input.safety_days ?? 0,
          version: 1,
          deleted: false,
          client_created_at: new Date().toISOString(),
          compliance: {
            ...(input.product_name ? { product_name: input.product_name } : {}),
            ...(input.treated_area_ha ? { treated_area_ha: input.treated_area_ha } : {}),
            ...(input.crop_code ? { crop_code: input.crop_code } : {}),
          },
        };
        const result = await client.pushEntries(input.farm_id, [entry]);
        return json({ entry_id: entry.id, ...result });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
