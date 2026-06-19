import type { AiPriority } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { getPriorityEmoji } from "@/lib/vehicle-logic";
import { cn } from "@/lib/utils";

const variantMap: Record<
  AiPriority,
  | "listNow"
  | "hold"
  | "priceDrop"
  | "auction"
  | "moneyTrap"
  | "urgent"
  | "buy"
  | "pass"
> = {
  "LIST NOW": "listNow",
  HOLD: "hold",
  "PRICE DROP": "priceDrop",
  AUCTION: "auction",
  "MONEY TRAP": "moneyTrap",
  URGENT: "urgent",
  BUY: "buy",
  PASS: "pass",
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
