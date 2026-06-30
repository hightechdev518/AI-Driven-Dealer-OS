import Link from "next/link";
import { Clock, Sparkles, Tag, TrendingDown, TrendingUp } from "lucide-react";
import type { AiPriority, Vehicle } from "@/lib/types";
import { getVehicleLabel } from "@/lib/vehicle-logic";
import { cn, formatCurrency } from "@/lib/utils";
import { VehiclePhoto } from "@/components/inventory/vehicle-photo";
import { VehicleStatsGrid } from "@/components/inventory/vehicle-stats-grid";

type UrgencyLevel = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

function getUrgencyLevel(priority: AiPriority | null | undefined): UrgencyLevel {
  switch (priority) {
    case "URGENT":
    case "AUCTION":
      return "URGENT";
    case "LIST NOW":
    case "PRICE DROP":
      return "HIGH";
    case "MONEY TRAP":
    case "PASS":
    case "BUY":
      return "MEDIUM";
    case "HOLD":
    default:
      return "LOW";
  }
}

const urgencyBadgeStyles: Record<UrgencyLevel, string> = {
  LOW: "bg-emerald-500/25 text-emerald-300 ring-emerald-400/30",
  MEDIUM: "bg-sky-500/25 text-sky-300 ring-sky-400/30",
  HIGH: "bg-amber-500/25 text-amber-300 ring-amber-400/35",
  URGENT: "bg-red-500/25 text-red-300 ring-red-400/35",
};

function getDisplayScore(vehicle: Vehicle): number {
  if (vehicle.ai_confidence != null) return Math.round(vehicle.ai_confidence);

  let score = 72;
  const roi = vehicle.roi ?? 0;
  const days = vehicle.days_in_stock ?? 0;

  if (roi > 20) score += 12;
  else if (roi > 10) score += 6;
  else if (roi < 5) score -= 8;
  if (days < 14) score += 8;
  else if (days > 60) score -= 18;
  else if (days > 45) score -= 10;
  if (!vehicle.listed_online) score += 4;

  return Math.min(99, Math.max(40, score));
}

function getMarketComparison(vehicle: Vehicle): {
  label: string;
  positive: boolean;
} | null {
  if (vehicle.market_avg == null || vehicle.recommended_price == null) return null;

  const pct =
    ((vehicle.recommended_price - vehicle.market_avg) / vehicle.market_avg) * 100;
  const abs = Math.abs(pct).toFixed(1);

  return {
    label: `${abs}% vs avg`,
    positive: pct >= 0,
  };
}

function getActionLabel(priority: AiPriority | null | undefined): string {
  switch (priority) {
    case "LIST NOW":
      return "List Now";
    case "PRICE DROP":
      return "Drop Price";
    case "AUCTION":
      return "Send to Auction";
    case "URGENT":
      return "Drop Price";
    case "MONEY TRAP":
      return "Review Price";
    case "BUY":
      return "Refresh Listing";
    case "PASS":
      return "Review Exit";
    case "HOLD":
    default:
      return "Hold";
  }
}

function getActionButtonStyles(priority: AiPriority | null | undefined): string {
  switch (priority) {
    case "LIST NOW":
      return "bg-cyan-400 text-slate-900 shadow-[0_0_20px_rgba(34,211,238,0.25)] group-hover:bg-cyan-300";
    case "URGENT":
      return "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)] group-hover:bg-red-400";
    case "PRICE DROP":
      return "bg-amber-400 text-slate-900 shadow-[0_0_20px_rgba(251,191,36,0.25)] group-hover:bg-amber-300";
    case "AUCTION":
      return "bg-slate-500 text-white shadow-[0_0_20px_rgba(100,116,139,0.3)] group-hover:bg-slate-400";
    case "MONEY TRAP":
      return "bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.25)] group-hover:bg-orange-400";
    case "BUY":
      return "bg-emerald-400 text-slate-900 shadow-[0_0_20px_rgba(52,211,153,0.25)] group-hover:bg-emerald-300";
    case "PASS":
      return "bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.25)] group-hover:bg-violet-400";
    case "HOLD":
    default:
      return "bg-emerald-500/90 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)] group-hover:bg-emerald-400";
  }
}

interface InventoryCardProps {
  vehicle: Vehicle;
}

export function InventoryCard({ vehicle }: InventoryCardProps) {
  const urgency = getUrgencyLevel(vehicle.ai_priority);
  const score = getDisplayScore(vehicle);
  const days = vehicle.days_in_stock ?? 0;
  const marketComparison = getMarketComparison(vehicle);
  const actionLabel = getActionLabel(vehicle.ai_priority);
  const title = getVehicleLabel(vehicle);

  const subtitle = [
    vehicle.vin ? `VIN ${vehicle.vin}` : "No VIN",
    vehicle.mileage != null ? `${vehicle.mileage.toLocaleString()} mi` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/inventory/${vehicle.id}`}
      className="group block cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0e14]"
    >
      <article className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0b0e14] shadow-[0_8px_32px_rgba(0,0,0,0.35)] transition-all duration-300 hover:border-white/[0.12] hover:shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden">
          <VehiclePhoto
            vehicle={vehicle}
            overlay
            className="h-full w-full object-cover brightness-[1.3] transition-transform duration-500 group-hover:scale-[1.03]"
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0e14]/95 via-[#0b0e14]/30 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-transparent" />

          <div className="absolute left-3 top-3 flex flex-wrap items-start gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset backdrop-blur-md",
                urgencyBadgeStyles[urgency]
              )}
            >
              <Sparkles className="h-3 w-3 shrink-0 opacity-90" />
              {urgency}
            </span>
            {!vehicle.listed_online && (
              <span className="inline-flex items-center rounded-full bg-violet-500/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-200 ring-1 ring-inset ring-violet-400/30 backdrop-blur-md">
                Unlisted
              </span>
            )}
          </div>

          <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/30 px-2.5 py-1 text-[11px] font-bold text-sky-200 ring-1 ring-inset ring-sky-400/30 backdrop-blur-md">
              <Sparkles className="h-3 w-3 opacity-80" />
              {score}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-slate-300 ring-1 ring-inset ring-white/10 backdrop-blur-md">
              <Clock className="h-3 w-3 opacity-70" />
              {days}d
            </span>
          </div>

          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-10">
            <h3 className="text-lg font-bold leading-tight tracking-tight text-white drop-shadow-sm transition-colors group-hover:text-cyan-100">
              {title}
            </h3>
            <p className="mt-0.5 text-sm text-slate-300/90">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-3">
          <VehicleStatsGrid vehicle={vehicle} />

          <p className="flex items-start gap-2 text-sm leading-relaxed text-slate-400">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-400/80" />
            <span>{vehicle.action_required ?? "No action required."}</span>
          </p>

          {vehicle.recommended_price != null && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-slate-200">
                <Tag className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-sky-400/90">AI:</span>
                {formatCurrency(vehicle.recommended_price)}
              </p>
              {marketComparison && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-xs font-medium tabular-nums",
                    marketComparison.positive ? "text-slate-400" : "text-amber-400/90"
                  )}
                >
                  {marketComparison.positive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {marketComparison.label}
                </span>
              )}
            </div>
          )}

          <div className="mt-auto flex gap-2 pt-1">
            <span
              className={cn(
                "flex-[1_1_75%] rounded-full py-2.5 text-center text-sm font-bold transition-colors",
                getActionButtonStyles(vehicle.ai_priority)
              )}
            >
              {actionLabel}
            </span>
            <span className="flex-[1_1_25%] rounded-full border border-white/10 bg-white/[0.04] py-2.5 text-center text-sm font-semibold text-slate-300 transition-colors group-hover:border-white/20 group-hover:bg-white/[0.08] group-hover:text-white">
              Details
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
