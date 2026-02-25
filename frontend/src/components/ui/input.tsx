import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex h-10 w-full rounded-lg border border-neutral-900/20 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-500 focus-visible:ring-2 focus-visible:ring-neutral-400/70 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-100/20 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-400 dark:focus-visible:ring-neutral-500/60",
      className,
    )}
    {...props}
  />
));

Input.displayName = "Input";
