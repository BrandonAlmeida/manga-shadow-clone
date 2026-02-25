import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

interface UseCursorAutoHideOptions {
  enabled: boolean;
  delayMs?: number;
}

export function useCursorAutoHide(
  containerRef: RefObject<HTMLElement | null>,
  { enabled, delayMs = 1200 }: UseCursorAutoHideOptions,
): boolean {
  const [isCursorHidden, setIsCursorHidden] = useState(false);
  const hideCursorTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const clearHideCursorTimer = () => {
      if (hideCursorTimerRef.current !== null) {
        window.clearTimeout(hideCursorTimerRef.current);
        hideCursorTimerRef.current = null;
      }
    };

    const scheduleHideCursor = () => {
      clearHideCursorTimer();
      hideCursorTimerRef.current = window.setTimeout(() => {
        setIsCursorHidden(true);
      }, delayMs);
    };

    const handleMouseMove = () => {
      setIsCursorHidden(false);
      scheduleHideCursor();
    };

    const handleMouseEnter = () => {
      setIsCursorHidden(false);
      scheduleHideCursor();
    };

    const handleMouseLeave = () => {
      clearHideCursorTimer();
      setIsCursorHidden(false);
    };

    container.addEventListener("mousemove", handleMouseMove, { passive: true });
    container.addEventListener("mouseenter", handleMouseEnter, { passive: true });
    container.addEventListener("mouseleave", handleMouseLeave, { passive: true });

    return () => {
      clearHideCursorTimer();
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseenter", handleMouseEnter);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [containerRef, delayMs, enabled]);

  return enabled && isCursorHidden;
}
