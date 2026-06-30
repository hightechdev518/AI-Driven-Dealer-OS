export type AiPriority =
  | "LIST NOW"
  | "HOLD"
  | "PRICE DROP"
  | "AUCTION"
  | "MONEY TRAP"
  | "URGENT"
  | "BUY"
  | "PASS";

export type FbListingStatus = "draft" | "published" | "sold";

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
  fb_listing_url: string | null;
  fb_listed_at: string | null;
  fb_listing_status: FbListingStatus | null;
  image_url: string | null;
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
  fb_listing_url?: string | null;
  fb_listed_at?: string | null;
  fb_listing_status?: FbListingStatus | null;
  image_url?: string | null;
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

export type MessageDirection = "inbound" | "outbound";
export type CustomerSource = "messenger" | "manual";

export interface Customer {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  fb_profile_url: string | null;
  fb_messenger_id: string | null;
  fb_conversation_id: string | null;
  source: CustomerSource | null;
  notes: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  customer_id: string;
  message: string;
  direction: MessageDirection;
  timestamp: string;
  read: boolean;
  fb_message_id: string | null;
  created_at: string;
}

export interface CustomerInquiry {
  id: string;
  customer_id: string;
  vehicle_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface ConversationSummary {
  customer: Customer;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}
