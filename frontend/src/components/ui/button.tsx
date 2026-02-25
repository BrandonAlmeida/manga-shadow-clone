import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "secondary" | "ghost" | "icon";
type ButtonSize = "default" | "sm" | "lg" | "icon";

function getVariantClassName(variant: ButtonVariant): string {
  if (variant === "secondary") {
    return "border border-neutral-900/20 bg-white text-neutral-800 hover:bg-neutral-100 dark:border-neutral-100/20 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800";
  }

  if (variant === "ghost") {
    return "border border-transparent bg-transparent text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800";
  }

  if (variant === "icon") {
    return "border border-neutral-900/20 bg-white text-neutral-800 hover:bg-neutral-100 dark:border-neutral-100/20 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800";
  }

  return "border border-neutral-900/25 bg-neutral-300/50 text-neutral-900 hover:bg-neutral-300/70 dark:border-neutral-100/25 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600";
}

function getSizeClassName(size: ButtonSize): string {
  if (size === "sm") {
    return "h-9 px-3";
  }

  if (size === "lg") {
    return "h-12 px-6";
  }

  if (size === "icon") {
    return "size-11";
  }

  return "h-11 px-5";
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "hover:cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/70 dark:focus-visible:ring-neutral-500/60 disabled:pointer-events-none disabled:opacity-50",
        getVariantClassName(variant),
        getSizeClassName(size),
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";
