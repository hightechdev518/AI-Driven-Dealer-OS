import type { AiPriority } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { getPriorityEmoji } from "@/lib/vehicle-logic";
import { cn } from "@/lib/utils";

const variantMap: Record<
  AiPriority,
  "listNow" | "hold" | "priceDrop" | "auction"
> = {
  "LIST NOW": "listNow",
  HOLD: "hold",
  "PRICE DROP": "priceDrop",
  AUCTION: "auction",
};

interface PriorityBadgeProps {
  priority: AiPriority | null | undefined;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  if (!priority) return null;

  return (
    <Badge variant={variantMap[priority]} className={cn("gap-1", className)}>
      <span>{getPriorityEmoji(priority)}</span>
      {priority}
    </Badge>
  );
}
