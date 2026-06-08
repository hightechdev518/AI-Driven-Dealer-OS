export type AiPriority = "LIST NOW" | "HOLD" | "PRICE DROP" | "AUCTION";

export interface Vehicle {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  mileage: number | null;
  vin: string | null;
  my_cost: number | null;
  repair_cost: number | null;
  total_invested: number | null;
  retail_price: number | null;
  auction_price: number | null;
  gross_profit: number | null;
  net_profit: number | null;
  roi: number | null;
  listed_online: boolean;
  online_channel: string | null;
  status: string | null;
  bought_date: string | null;
  days_in_stock: number | null;
  market_low: number | null;
  market_avg: number | null;
  market_high: number | null;
  comp_count: number | null;
  ai_confidence: number | null;
  ai_priority: AiPriority | null;
  recommended_price: number | null;
  action_required: string | null;
  notes: string | null;
  created_at: string;
}

export interface MarketComp {
  id: string;
  vehicle_id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  mileage: number | null;
  source: string | null;
  location: string | null;
  listing_price: number | null;
  url: string | null;
  source_notes: string | null;
  date_checked: string | null;
}

export interface VehicleFormData {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  mileage?: number | null;
  vin?: string | null;
  my_cost?: number | null;
  repair_cost?: number | null;
  retail_price?: number | null;
  auction_price?: number | null;
  listed_online?: boolean;
  online_channel?: string | null;
  status?: string | null;
  bought_date?: string | null;
  days_in_stock?: number | null;
  market_low?: number | null;
  market_avg?: number | null;
  market_high?: number | null;
  comp_count?: number | null;
  notes?: string | null;
}

export interface AiExtractedVehicle {
  year: number | null;
  make: string | null;
  model: string | null;
  mileage: number | null;
  my_cost: number | null;
  repair_cost: number | null;
  retail_price: number | null;
  notes: string | null;
  online_channel: string | null;
}
