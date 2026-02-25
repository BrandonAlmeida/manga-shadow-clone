import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  isActive?: boolean;
  caption?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, icon, label, isActive = false, caption, ...props }, ref) => (
    <Button
      ref={ref}
      variant="icon"
      size="icon"
      aria-label={label}
      className={cn(isActive && "border-neutral-900/30 bg-neutral-200 text-neutral-950", className)}
      {...props}
    >
      <span className="flex flex-col items-center justify-center leading-none">
        <span>{icon}</span>
        {caption ? <span className="text-[9px] font-bold tabular-nums">{caption}</span> : null}
      </span>
    </Button>
  ),
);

IconButton.displayName = "IconButton";
