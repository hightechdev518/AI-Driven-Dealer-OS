import { formatCurrency } from "@/lib/utils";
import type { Vehicle } from "@/lib/types";

interface VehicleStatsGridProps {
  vehicle: Pick<Vehicle, "total_invested" | "retail_price" | "net_profit">;
  className?: string;
}

export function VehicleStatsGrid({ vehicle, className }: VehicleStatsGridProps) {
  return (
    <div
      className={`grid grid-cols-3 overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] ${className ?? ""}`}
    >
      <div className="border-r border-white/[0.06] px-3 py-3 sm:px-4 sm:py-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Invested
        </p>
        <p className="mt-1 text-base font-bold tabular-nums text-white sm:text-lg">
          {formatCurrency(vehicle.total_invested)}
        </p>
      </div>
      <div className="border-r border-white/[0.06] px-3 py-3 sm:px-4 sm:py-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          List
        </p>
        <p className="mt-1 text-base font-bold tabular-nums text-sky-400 sm:text-lg">
          {formatCurrency(vehicle.retail_price)}
        </p>
      </div>
      <div className="px-3 py-3 sm:px-4 sm:py-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Net
        </p>
        <p className="mt-1 text-base font-bold tabular-nums text-emerald-400 sm:text-lg">
          {formatCurrency(vehicle.net_profit)}
        </p>
      </div>
    </div>
  );
}
