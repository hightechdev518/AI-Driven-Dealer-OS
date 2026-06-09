import type { AiPriority, Vehicle, VehicleFormData } from "./types";

export function computeDaysInStock(
  boughtDate: string | null | undefined,
  explicitDays?: number | null
): number {
  if (explicitDays != null && explicitDays > 0) return explicitDays;
  if (!boughtDate) return 0;
  const bought = new Date(boughtDate);
  const today = new Date();
  const diff = today.getTime() - bought.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function computeAiPriority(
  listedOnline: boolean,
  daysInStock: number
): AiPriority {
  if (!listedOnline) return "LIST NOW";
  if (daysInStock > 90) return "AUCTION";
  if (daysInStock > 45 && listedOnline) return "PRICE DROP";
  return "HOLD";
}

export function computeRecommendedPrice(
  retailPrice: number | null,
  marketAvg: number | null,
  compCount: number | null,
  daysInStock: number
): number | null {
  if (compCount != null && compCount >= 3 && marketAvg != null) {
    return Math.round(marketAvg * 1.05);
  }
  if (daysInStock > 45 && marketAvg != null) {
    return Math.round(marketAvg * 0.95);
  }
  return retailPrice;
}

export function computeActionRequired(priority: AiPriority): string {
  switch (priority) {
    case "LIST NOW":
      return "List vehicle online immediately";
    case "PRICE DROP":
      return "Reduce price to move inventory faster";
    case "AUCTION":
      return "Consider auction — too long in stock";
    case "HOLD":
      return "Monitor market — no action needed";
  }
}

export function enrichVehicle(data: VehicleFormData & { id?: string }): Omit<
  Vehicle,
  "id" | "created_at"
> & { id?: string } {
  const myCost = data.my_cost ?? 0;
  const repairCost = data.repair_cost ?? 0;
  const totalInvested = myCost + repairCost;
  const retailPrice = data.retail_price ?? null;
  const auctionPrice = data.auction_price ?? null;
  const grossProfit =
    retailPrice != null ? retailPrice - totalInvested : null;
  const netProfit = grossProfit;
  const roi =
    totalInvested > 0 && netProfit != null
      ? (netProfit / totalInvested) * 100
      : null;

  const daysInStock = computeDaysInStock(
    data.bought_date,
    data.days_in_stock
  );
  const listedOnline = data.listed_online ?? false;
  const aiPriority = computeAiPriority(listedOnline, daysInStock);
  const recommendedPrice = computeRecommendedPrice(
    retailPrice,
    data.market_avg ?? null,
    data.comp_count ?? null,
    daysInStock
  );
  const actionRequired = computeActionRequired(aiPriority);

  return {
    id: data.id,
    year: data.year ?? null,
    make: data.make ?? null,
    model: data.model ?? null,
    mileage: data.mileage ?? null,
    vin: data.vin ?? null,
    my_cost: myCost,
    repair_cost: repairCost,
    total_invested: totalInvested,
    retail_price: retailPrice,
    auction_price: auctionPrice,
    gross_profit: grossProfit,
    net_profit: netProfit,
    roi,
    listed_online: listedOnline,
    online_channel: data.online_channel ?? null,
    status: data.status ?? "In Stock",
    bought_date: data.bought_date ?? null,
    days_in_stock: daysInStock,
    market_low: data.market_low ?? null,
    market_avg: data.market_avg ?? null,
    market_high: data.market_high ?? null,
    comp_count: data.comp_count ?? null,
    ai_confidence: null,
    ai_priority: aiPriority,
    recommended_price: recommendedPrice,
    action_required: actionRequired,
    notes: data.notes ?? null,
    fb_listing_url: data.fb_listing_url ?? null,
    fb_listed_at: data.fb_listed_at ?? null,
    fb_listing_status: data.fb_listing_status ?? null,
  };
}

export function enrichVehicleRecord(vehicle: Vehicle): Vehicle {
  const enriched = enrichVehicle({
    ...vehicle,
    days_in_stock: vehicle.days_in_stock,
  });
  return { ...vehicle, ...enriched, id: vehicle.id, created_at: vehicle.created_at };
}

export function getVehicleLabel(vehicle: Pick<Vehicle, "year" | "make" | "model">): string {
  const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Unknown Vehicle";
}

export function getPriorityEmoji(priority: AiPriority | null | undefined): string {
  switch (priority) {
    case "LIST NOW":
      return "🔥";
    case "HOLD":
      return "🟢";
    case "PRICE DROP":
      return "🟡";
    case "AUCTION":
      return "⚫";
    default:
      return "";
  }
}

export function generateAiSummary(vehicle: Vehicle): string {
  const label = getVehicleLabel(vehicle);
  const days = vehicle.days_in_stock ?? 0;
  const priority = vehicle.ai_priority ?? "HOLD";
  const emoji = getPriorityEmoji(priority);

  let summary = `${emoji} ${label} — Priority: ${priority}. `;

  if (vehicle.comp_count && vehicle.comp_count >= 3) {
    summary += `Based on ${vehicle.comp_count} market comps, average market price is ${vehicle.market_avg != null ? `$${vehicle.market_avg.toLocaleString()}` : "N/A"}. `;
    if (vehicle.market_low && vehicle.market_high) {
      summary += `Market range: $${vehicle.market_low.toLocaleString()} – $${vehicle.market_high.toLocaleString()}. `;
    }
  } else {
    summary += `Limited comp data (${vehicle.comp_count ?? 0} listings). Consider adding more market comps. `;
  }

  if (vehicle.recommended_price) {
    summary += `Recommended price: $${vehicle.recommended_price.toLocaleString()}. `;
  }

  if (days > 90) {
    summary += `Vehicle has been in stock ${days} days — auction may be the best exit strategy.`;
  } else if (days > 45) {
    summary += `In stock ${days} days — consider a price adjustment to improve turnover.`;
  } else if (!vehicle.listed_online) {
    summary += `Not yet listed online — list on ${vehicle.online_channel || "marketplace channels"} to generate leads.`;
  } else {
    summary += `In stock ${days} days — holding position looks reasonable.`;
  }

  return summary;
}
