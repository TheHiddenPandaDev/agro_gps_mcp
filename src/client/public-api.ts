import { requestJson } from "./http.js";

export interface PublicConfig {
  apiUrl: string;
  timeout: number;
}

export interface Authorisation {
  state: string;
  level: string;
}

export interface ProductMatch {
  registration_number: string;
  name: string;
  holder?: string;
  status?: string;
  authorisation?: Authorisation;
}

export interface ProductDetail extends ProductMatch {
  register_country?: string;
  [field: string]: unknown;
}

export class AgroGPSPublicClient {
  private readonly phytoUrl: string;
  private readonly timeout: number;

  constructor(config: PublicConfig, private readonly fetchImpl: typeof fetch = fetch) {
    this.phytoUrl = `${new URL(config.apiUrl).origin}/api/public/phyto/`;
    this.timeout = config.timeout;
  }

  searchProducts(query: string, country: string): Promise<{ matches: ProductMatch[] }> {
    const url = new URL(this.phytoUrl);
    url.searchParams.set("q", query);
    url.searchParams.set("country", country);
    return requestJson(this.fetchImpl, { method: "GET", url, timeout: this.timeout });
  }

  lookupProduct(registration: string, country: string, crop?: string): Promise<ProductDetail> {
    const url = new URL(this.phytoUrl + encodeURIComponent(registration));
    url.searchParams.set("country", country);
    if (crop) url.searchParams.set("crop", crop);
    return requestJson(this.fetchImpl, { method: "GET", url, timeout: this.timeout });
  }
}
