import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AgroGPSPublicClient } from "../client/public-api.js";
import { countryPageUrl, productPageUrl } from "./product-links.js";
import { READ_ONLY, handleToolError, json } from "./shared.js";

const SOURCE = "Agro GPS mirror of the official plant protection product registers (agrogps.eu)";

const country = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, "Two-letter country code, e.g. ES, FR, DE")
  .transform((c) => c.toUpperCase())
  .describe("ISO 3166-1 alpha-2 country whose official register to use, e.g. ES, FR, DE, IT, PT, PL");

export function registerPhytoTools(server: McpServer, client: AgroGPSPublicClient): void {
  server.registerTool(
    "search_plant_protection_products",
    {
      title: "Search plant protection products",
      description:
        "Free, no API key. Searches the official register of plant protection products (pesticides, fungicides, " +
        "herbicides) of a European country by commercial product name and says whether each one is still " +
        "authorised. Returns up to 15 matches with registration number, holder, status and a link to its page. " +
        "Search by trade name (e.g. 'Roundup'), not by active substance.",
      annotations: READ_ONLY,
      inputSchema: {
        q: z.string().trim().min(3).max(100).describe("At least three letters of the commercial product name"),
        country,
      },
    },
    async ({ q, country: code }) => {
      try {
        const { matches } = await client.searchProducts(q, code);
        const withLinks = (matches ?? []).map((m) => ({
          ...m,
          page_url: productPageUrl(code, m.name, m.registration_number),
        }));
        return json({
          country: code,
          query: q,
          matches: withLinks,
          ...(withLinks.length === 0
            ? {
                note:
                  "No product matches. Try a shorter or different trade name. If this country's register is not " +
                  "mirrored yet the search is always empty.",
              }
            : {}),
          more: countryPageUrl(code),
          source: SOURCE,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    "check_plant_protection_product",
    {
      title: "Check a plant protection product",
      description:
        "Free, no API key. Looks up one product by its official registration number in a country's register: " +
        "authorisation state (authorised / withdrawn / expired), expiry date, formulation, active substances and " +
        "authorised uses. With crop_eppo it also says whether the product is authorised on that crop. Includes a " +
        "link to the product page.",
      annotations: READ_ONLY,
      inputSchema: {
        registration: z.string().trim().min(1).max(40).describe("Official registration number, e.g. ES-00725, 7400057"),
        country,
        crop_eppo: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9]{3,8}$/, "EPPO crop code, e.g. OLVEU, VITVI")
          .transform((c) => c.toUpperCase())
          .optional()
          .describe("EPPO code of the crop to check the product against, e.g. VITVI (grapevine), OLVEU (olive)"),
      },
    },
    async ({ registration, country: code, crop_eppo }) => {
      try {
        const product = await client.lookupProduct(registration, code, crop_eppo);
        return json({
          ...product,
          page_url: productPageUrl(code, product.name, product.registration_number, product.register_country),
          source: SOURCE,
        });
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
