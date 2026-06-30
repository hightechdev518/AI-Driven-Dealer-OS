import {
  FILTER_TABS,
  type FilterTab,
} from "@/lib/inventory-filters";
import { cn } from "@/lib/utils";

interface InventoryFilterTabsProps {
  activeFilter: FilterTab;
  onFilterChange: (filter: FilterTab) => void;
  counts: Record<FilterTab, number>;
}

export function InventoryFilterTabs({
  activeFilter,
  onFilterChange,
  counts,
}: InventoryFilterTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTER_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onFilterChange(tab.id)}
          className={cn(
            "group inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            activeFilter === tab.id
              ? "bg-white/10 text-white ring-1 ring-white/20"
              : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
          )}
        >
          {tab.label}
          <span
            className={cn(
              "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none",
              activeFilter === tab.id
                ? "bg-white/15 text-white"
                : "bg-white/[0.06] text-slate-400 group-hover:text-slate-300"
            )}
          >
            {counts[tab.id]}
          </span>
        </button>
      ))}
    </div>
  );
}
