import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_LOGIC_RULES } from "@/lib/logic-engine/default-rules";
import { evaluateAllRules, evaluateRule } from "@/lib/logic-engine/evaluator";
import { loadAllRules } from "@/lib/logic-engine/storage";
import type { VehicleRuleContext } from "@/lib/logic-engine/types";
import type { Vehicle } from "@/lib/types";

type InquiryRow = {
  vehicle_id: string | null;
  created_at: string;
};

type VehicleRow = Vehicle & { bought_date: string | null };

function computeDaysInStock(boughtDate: string | null | undefined): number {
  if (!boughtDate) return 0;
  return Math.floor(
    (Date.now() - new Date(boughtDate).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function buildLeadStats(inquiries: InquiryRow[]) {
  const leadCountByVehicle = new Map<string, number>();
  const oldestLeadByVehicle = new Map<string, number>();

  const now = Date.now();

  for (const inquiry of inquiries) {
    if (!inquiry.vehicle_id) continue;

    leadCountByVehicle.set(
      inquiry.vehicle_id,
      (leadCountByVehicle.get(inquiry.vehicle_id) ?? 0) + 1
    );

    const ageMinutes = Math.floor(
      (now - new Date(inquiry.created_at).getTime()) / 60000
    );
    const current = oldestLeadByVehicle.get(inquiry.vehicle_id);
    if (current == null || ageMinutes > current) {
      oldestLeadByVehicle.set(inquiry.vehicle_id, ageMinutes);
    }
  }

  return { leadCountByVehicle, oldestLeadByVehicle };
}

function toRuleContext(
  vehicle: VehicleRow,
  daysInStock: number,
  leadCount: number,
  oldestLeadAgeMinutes: number | null
): VehicleRuleContext {
  return {
    daysInStock,
    netProfit: vehicle.net_profit ?? 0,
    leadCount,
    oldestLeadAgeMinutes,
    compCount: vehicle.comp_count ?? 0,
    listedOnline: vehicle.listed_online ?? false,
    retailPrice: vehicle.retail_price,
    recommendedPrice: vehicle.recommended_price,
    marketAvg: vehicle.market_avg,
  };
}

export async function POST() {
  try {
    const supabase = createServerClient();
    const rules = await loadAllRules(DEFAULT_LOGIC_RULES);

    const { data: vehicles, error: vehiclesError } = await supabase
      .from("vehicles")
      .select("*")
      .eq("status", "available");

    if (vehiclesError) throw vehiclesError;

    const vehicleList = (vehicles ?? []) as VehicleRow[];
    console.log("Vehicles fetched:", vehicleList.length);

    vehicleList.forEach((v) => {
      const daysInStock = computeDaysInStock(v.bought_date);
      console.log(v.make, v.model, "days:", daysInStock);
    });

    const { data: inquiries, error: inquiriesError } = await supabase
      .from("customer_inquiries")
      .select("vehicle_id, created_at");

    if (inquiriesError) throw inquiriesError;

    const { leadCountByVehicle, oldestLeadByVehicle } = buildLeadStats(
      inquiries ?? []
    );

    const results: Array<{
      vehicle_id: string;
      ai_priority: string;
      action_required: string;
      recommended_price: number | null;
      matched_rule: string;
      matched_rules: string[];
    }> = [];

    for (const vehicle of vehicleList) {
      const daysInStock = computeDaysInStock(vehicle.bought_date);
      const leadCount = leadCountByVehicle.get(vehicle.id) ?? 0;
      const oldestLeadAge = oldestLeadByVehicle.get(vehicle.id) ?? null;
      const ctx = toRuleContext(vehicle, daysInStock, leadCount, oldestLeadAge);

      const matchedRules = rules
        .filter((rule) => rule.active)
        .map((rule) => evaluateRule(rule, ctx))
        .filter((hit) => hit != null)
        .map((hit) => hit!.rule.name);

      console.log(
        `${vehicle.make} ${vehicle.model} matched rules:`,
        matchedRules.length > 0 ? matchedRules.join(", ") : "none (default HOLD)"
      );

      const hit = evaluateAllRules(rules, ctx);

      const update = {
        ai_priority: hit.ai_priority,
        action_required: hit.action_required,
        recommended_price: hit.recommended_price,
        days_in_stock: daysInStock,
      };

      const { error: updateError } = await supabase
        .from("vehicles")
        .update(update)
        .eq("id", vehicle.id);

      if (updateError) throw updateError;

      results.push({
        vehicle_id: vehicle.id,
        ai_priority: hit.ai_priority,
        action_required: hit.action_required,
        recommended_price: hit.recommended_price,
        matched_rule: hit.rule.name,
        matched_rules: matchedRules,
      });
    }

    return NextResponse.json({
      updated: results.length,
      results,
    });
  } catch (error) {
    console.error("POST /api/logic-engine/run:", error);
    return NextResponse.json(
      { error: "Failed to run logic engine rules" },
      { status: 500 }
    );
  }
}
