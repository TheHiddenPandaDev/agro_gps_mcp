import type { ApiEnvelope } from "../types/index.js";
import { USER_AGENT } from "../version.js";

export class AgroGPSApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AgroGPSApiError";
  }
}

export const TIMEOUT_CODE = "TIMEOUT";
export const NETWORK_CODE = "NETWORK";

export interface JsonRequest {
  method: "GET" | "POST";
  url: URL;
  headers?: Record<string, string>;
  body?: unknown;
  timeout: number;
}

export async function requestJson<T>(fetchImpl: typeof fetch, request: JsonRequest): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeout);
  try {
    let response: Response;
    try {
      response = await fetchImpl(request.url, {
        method: request.method,
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
          ...(request.body ? { "Content-Type": "application/json" } : {}),
          ...request.headers,
        },
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new AgroGPSApiError(TIMEOUT_CODE, `No answer from Agro GPS within ${request.timeout} ms`, 0);
      }
      throw new AgroGPSApiError(NETWORK_CODE, error instanceof Error ? error.message : String(error), 0);
    }
    const text = await response.text();
    let parsed: ApiEnvelope<T> | undefined;
    try {
      parsed = text ? (JSON.parse(text) as ApiEnvelope<T>) : undefined;
    } catch {
      parsed = undefined;
    }
    if (!response.ok) {
      throw new AgroGPSApiError(
        parsed?.code ?? `HTTP_${response.status}`,
        parsed?.message ?? response.statusText,
        response.status,
      );
    }
    if (!parsed) throw new AgroGPSApiError("EMPTY", "Empty response", response.status);
    return (parsed.data ?? parsed) as T;
  } finally {
    clearTimeout(timer);
  }
}
