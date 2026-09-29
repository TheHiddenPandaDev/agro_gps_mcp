export interface ServerConfig {
  apiKey?: string;
  apiUrl: string;
  timeout: number;
}

export interface ApiEnvelope<T> {
  success?: boolean;
  data: T;
  code?: string;
  message?: string;
}

export interface Farm {
  id: string;
  name: string;
  country: string;
  plan: string;
  role: string;
  compliance_ready: boolean;
  compliance_missing: string[];
}

export interface Entry {
  id: string;
  parcel_refcat: string;
  entry_type: string;
  title: string;
  event_at: string;
  quantity: number;
  unit: string;
  cost_cents: number;
  price_per_kg_cents: number;
  registration_number: string;
  safety_days: number;
  version: number;
  deleted: boolean;
  compliance?: Record<string, unknown>;
}

export interface EntriesPage {
  farm_id: string;
  entries: Entry[];
  next: number;
  has_more: boolean;
}

export interface GroupItem {
  id: string;
  name: string;
  role: string;
  farms: number;
}

export interface PushResult {
  id: string;
  result: "accepted" | "duplicate" | "stale" | "rejected";
}
