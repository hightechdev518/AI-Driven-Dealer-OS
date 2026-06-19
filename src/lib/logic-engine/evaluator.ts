import type { AiPriority } from "@/lib/types";
import type {
  LogicRule,
  RuleHit,
  VehicleRuleContext,
} from "./types";

const PRIORITY_SEVERITY: Record<AiPriority, number> = {
  URGENT: 100,
  AUCTION: 90,
  PASS: 85,
  "LIST NOW": 80,
  "PRICE DROP": 70,
  "MONEY TRAP": 65,
  BUY: 50,
  HOLD: 10,
};

function basePrice(ctx: VehicleRuleContext): number | null {
  return ctx.recommendedPrice ?? ctx.retailPrice ?? ctx.marketAvg;
}

function adjustPrice(
  ctx: VehicleRuleContext,
  percent: number
): number | null {
  const base = basePrice(ctx);
  if (base == null) return ctx.recommendedPrice;
  return Math.round(base * (1 + percent / 100));
}

function evaluateBuiltInRule(
  rule: LogicRule,
  ctx: VehicleRuleContext
): RuleHit | null {
  const price = basePrice(ctx);

  switch (rule.id) {
    case "money-trap":
      if (ctx.daysInStock > 45) {
        return {
          rule,
          ai_priority: "MONEY TRAP",
          action_required: "Money Trap — aging inventory, review pricing strategy",
          recommended_price: price,
          severity: PRIORITY_SEVERITY["MONEY TRAP"],
        };
      }
      break;

    case "auction":
      if (ctx.daysInStock > 75 && ctx.netProfit < 1000) {
        return {
          rule,
          ai_priority: "AUCTION",
          action_required: "Send to auction — low profit and aging stock",
          recommended_price: price,
          severity: PRIORITY_SEVERITY.AUCTION,
        };
      }
      break;

    case "price-drop":
      if (ctx.daysInStock > 21 && ctx.leadCount < 3) {
        return {
          rule,
          ai_priority: "PRICE DROP",
          action_required: "Reduce price 5% — low lead volume",
          recommended_price: adjustPrice(ctx, -5),
          severity: PRIORITY_SEVERITY["PRICE DROP"],
        };
      }
      break;

    case "price-increase":
      if (
        ctx.listedOnline &&
        ctx.leadCount >= 3 &&
        ctx.compCount < 3 &&
        ctx.daysInStock <= 45
      ) {
        return {
          rule,
          ai_priority: "HOLD",
          action_required: "Raise price 3% — high demand, low competition",
          recommended_price: adjustPrice(ctx, 3),
          severity: PRIORITY_SEVERITY.HOLD + 5,
        };
      }
      break;

    case "lead-response":
      if (
        ctx.oldestLeadAgeMinutes != null &&
        ctx.oldestLeadAgeMinutes > 15
      ) {
        return {
          rule,
          ai_priority: "URGENT",
          action_required: `URGENT — lead waiting ${ctx.oldestLeadAgeMinutes} min, respond now`,
          recommended_price: price,
          severity: PRIORITY_SEVERITY.URGENT,
        };
      }
      break;

    case "buy-score":
      if (ctx.netProfit > 1500 && ctx.daysInStock < 14) {
        return {
          rule,
          ai_priority: "BUY",
          action_required: "BUY — strong profit potential, fast mover",
          recommended_price: price,
          severity: PRIORITY_SEVERITY.BUY,
        };
      }
      break;

    case "do-not-buy":
      if (ctx.netProfit < 800 || ctx.daysInStock > 45) {
        return {
          rule,
          ai_priority: "PASS",
          action_required: "PASS — low margin or slow mover, consider exit",
          recommended_price: price,
          severity: PRIORITY_SEVERITY.PASS,
        };
      }
      break;
  }

  return null;
}

function matchesCustomRule(
  match: NonNullable<LogicRule["match"]>,
  ctx: VehicleRuleContext
): boolean {
  if (match.minDaysInStock != null && ctx.daysInStock < match.minDaysInStock) {
    return false;
  }
  if (match.maxDaysInStock != null && ctx.daysInStock > match.maxDaysInStock) {
    return false;
  }
  if (match.minProfit != null && ctx.netProfit < match.minProfit) {
    return false;
  }
  if (match.maxProfit != null && ctx.netProfit > match.maxProfit) {
    return false;
  }
  if (match.minLeads != null && ctx.leadCount < match.minLeads) {
    return false;
  }
  if (match.maxLeads != null && ctx.leadCount > match.maxLeads) {
    return false;
  }
  if (match.minCompCount != null && ctx.compCount < match.minCompCount) {
    return false;
  }
  if (match.maxCompCount != null && ctx.compCount > match.maxCompCount) {
    return false;
  }
  if (
    match.minLeadAgeMinutes != null &&
    (ctx.oldestLeadAgeMinutes == null ||
      ctx.oldestLeadAgeMinutes < match.minLeadAgeMinutes)
  ) {
    return false;
  }
  if (match.requireListed === true && !ctx.listedOnline) {
    return false;
  }
  return true;
}

function evaluateCustomRule(
  rule: LogicRule,
  ctx: VehicleRuleContext
): RuleHit | null {
  if (!rule.match || !rule.output) return null;
  if (!matchesCustomRule(rule.match, ctx)) return null;

  let recommended_price = ctx.recommendedPrice ?? ctx.retailPrice;
  if (rule.output.priceAdjustPercent != null) {
    recommended_price = adjustPrice(ctx, rule.output.priceAdjustPercent);
  }

  return {
    rule,
    ai_priority: rule.output.ai_priority,
    action_required: rule.output.action_required,
    recommended_price,
    severity: PRIORITY_SEVERITY[rule.output.ai_priority] ?? 50,
  };
}

export function evaluateRule(
  rule: LogicRule,
  ctx: VehicleRuleContext
): RuleHit | null {
  if (!rule.active) return null;
  if (rule.builtIn) return evaluateBuiltInRule(rule, ctx);
  return evaluateCustomRule(rule, ctx);
}

export function evaluateAllRules(
  rules: LogicRule[],
  ctx: VehicleRuleContext
): RuleHit {
  const hits = rules
    .map((rule) => evaluateRule(rule, ctx))
    .filter((hit): hit is RuleHit => hit != null);

  if (hits.length === 0) {
    return {
      rule: {
        id: "default-hold",
        name: "Default",
        summary: "No rules matched",
        condition: "—",
        action: "Hold",
        category: "inventory",
        active: true,
        builtIn: true,
      },
      ai_priority: "HOLD",
      action_required: "Monitor market — no action needed",
      recommended_price: basePrice(ctx),
      severity: PRIORITY_SEVERITY.HOLD,
    };
  }

  return hits.sort((a, b) => b.severity - a.severity)[0];
}
