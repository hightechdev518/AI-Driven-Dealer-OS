import { Badge } from "@/components/ui/badge";
import type { FbListingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  FbListingStatus,
  { label: string; className: string }
> = {
  published: {
    label: "Listed on FB",
    className: "bg-blue-600/20 text-blue-400 border-blue-500/30",
  },
  draft: {
    label: "FB Draft",
    className: "bg-yellow-600/20 text-yellow-400 border-yellow-500/30",
  },
  sold: {
    label: "Sold on FB",
    className: "bg-green-600/20 text-green-400 border-green-500/30",
  },
};

export function FbListingBadge({
  status,
  className,
}: {
  status: FbListingStatus | null | undefined;
  className?: string;
}) {
  if (!status) {
    return (
      <Badge
        variant="outline"
        className={cn("border-slate-600 text-slate-400", className)}
      >
        Not Listed
      </Badge>
    );
  }

  const config = statusConfig[status];
  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
