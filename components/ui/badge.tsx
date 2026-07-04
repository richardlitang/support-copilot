import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium leading-4 transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-graphite text-paper",
        secondary: "border-transparent bg-zinc-100 text-zinc-900",
        outline: "border-zinc-200 text-zinc-700",
        success: "border-sage/25 bg-sage/10 text-sage",
        warn: "border-copper/25 bg-copper/10 text-copper",
        danger: "border-ember/25 bg-ember/10 text-ember",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
