import type { Vehicle } from "@/lib/types";

export type FilterTab = "all" | "urgent" | "action" | "unlisted" | "aging";

export const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "urgent", label: "Urgent" },
  { id: "action", label: "Action Required" },
  { id: "unlisted", label: "Unlisted" },
  { id: "aging", label: "Aging" },
];

export function matchesFilter(vehicle: Vehicle, filter: FilterTab): boolean {
  switch (filter) {
    case "urgent":
      return vehicle.ai_priority === "URGENT" || vehicle.ai_priority === "AUCTION";
    case "action":
      return vehicle.ai_priority !== "HOLD";
    case "unlisted":
      return !vehicle.listed_online;
    case "aging":
      return (vehicle.days_in_stock ?? 0) >= 45;
    case "all":
    default:
      return true;
  }
}

export function countByFilter(vehicles: Vehicle[]): Record<FilterTab, number> {
  const counts = {} as Record<FilterTab, number>;
  for (const tab of FILTER_TABS) {
    counts[tab.id] = vehicles.filter((v) => matchesFilter(v, tab.id)).length;
  }
  return counts;
}
