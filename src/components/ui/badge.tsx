import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-orange-500 text-white",
        secondary: "border-transparent bg-slate-700 text-slate-100",
        outline: "border-slate-600 text-slate-300",
        listNow: "border-transparent bg-red-600 text-white",
        hold: "border-transparent bg-green-600 text-white",
        priceDrop: "border-transparent bg-yellow-500 text-black",
        auction: "border-transparent bg-black text-white border border-slate-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
