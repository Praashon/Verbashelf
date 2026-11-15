import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "destructive"
  | "violet";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  primary:
    "bg-primary text-primary-foreground border-transparent",
  secondary:
    "bg-secondary text-secondary-foreground border-border/60",
  outline:
    "bg-transparent text-foreground border-border",
  destructive:
    "bg-destructive text-destructive-foreground border-transparent",
  violet:
    "bg-[#63e]/12 text-[#5227cc] border-[#63e]/25 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-400/30",
};

export function Badge({
  className,
  variant = "secondary",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
