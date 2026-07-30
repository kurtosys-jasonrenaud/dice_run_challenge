import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45 active:scale-[.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary px-5 py-3 text-primary-foreground shadow-[0_8px_24px_-10px_var(--primary)] hover:-translate-y-0.5 hover:bg-ink",
        outline:
          "border border-border bg-transparent px-4 py-2.5 text-foreground hover:bg-muted",
        ghost: "px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground",
        destructive: "bg-destructive px-4 py-2.5 text-white hover:brightness-105",
      },
      size: {
        default: "h-11",
        sm: "h-9 text-xs",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card text-card-foreground shadow-[0_18px_45px_-35px_rgba(23,35,53,.55)]",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
