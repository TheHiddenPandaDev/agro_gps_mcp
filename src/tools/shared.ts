import { AgroGPSApiError, MISSING_KEY_CODE } from "../client/agrogps-api.js";
import { NETWORK_CODE, TIMEOUT_CODE } from "../client/http.js";
import { APP_URL } from "./product-links.js";

export const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export const MISSING_KEY_MESSAGE =
  `This tool reads your own farm data, so it needs an Agro GPS API key. Create one in the app at ${APP_URL} ` +
  "(Settings → API and webhooks) and set it as AGROGPS_API_KEY. " +
  "The plant protection product tools work without a key.";

const RATE_LIMIT_STATUS = 429;

export function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorText(text: string) {
  return { isError: true, content: [{ type: "text" as const, text }] };
}

function hintFor(error: AgroGPSApiError): string {
  if (error.status === 401) return " Check AGROGPS_API_KEY.";
  if (error.status === 403) {
    return " This key cannot do that (read-only key, or an action that needs a person's session).";
  }
  return "";
}

export function handleToolError(error: unknown) {
  if (error instanceof AgroGPSApiError) {
    if (error.code === MISSING_KEY_CODE) return errorText(MISSING_KEY_MESSAGE);
    if (error.status === RATE_LIMIT_STATUS) {
      return errorText("Agro GPS rate limit reached (too many requests from this address). Wait a minute and retry.");
    }
    if (error.code === TIMEOUT_CODE) return errorText(`${error.message}. Retry, or raise AGROGPS_TIMEOUT_MS.`);
    if (error.code === NETWORK_CODE) return errorText(`Could not reach Agro GPS: ${error.message}.`);
    return errorText(`Agro GPS API error ${error.code}: ${error.message}.${hintFor(error)}`);
  }
  const message = error instanceof Error ? error.message : String(error);
  return errorText(`Unexpected error: ${message}`);
}
