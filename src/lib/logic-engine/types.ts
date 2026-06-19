import type { AiPriority } from "@/lib/types";

export type LogicRuleCategory =
  | "inventory"
  | "pricing"
  | "leads"
  | "acquisition";

export interface LogicRuleMatch {
  minDaysInStock?: number;
  maxDaysInStock?: number;
  minProfit?: number;
  maxProfit?: number;
  minLeads?: number;
  maxLeads?: number;
  minCompCount?: number;
  maxCompCount?: number;
  minLeadAgeMinutes?: number;
  requireListed?: boolean;
}

export interface LogicRuleOutput {
  ai_priority: AiPriority;
  action_required: string;
  priceAdjustPercent?: number;
}

export interface LogicRule {
  id: string;
  name: string;
  summary: string;
  condition: string;
  action: string;
  category: LogicRuleCategory;
  active: boolean;
  builtIn: boolean;
  match?: LogicRuleMatch;
  output?: LogicRuleOutput;
  createdAt?: string;
}

export interface VehicleRuleContext {
  daysInStock: number;
  netProfit: number;
  leadCount: number;
  oldestLeadAgeMinutes: number | null;
  compCount: number;
  listedOnline: boolean;
  retailPrice: number | null;
  recommendedPrice: number | null;
  marketAvg: number | null;
}

export interface RuleHit {
  rule: LogicRule;
  ai_priority: AiPriority;
  action_required: string;
  recommended_price: number | null;
  severity: number;
}
