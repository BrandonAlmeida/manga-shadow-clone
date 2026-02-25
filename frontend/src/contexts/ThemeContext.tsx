import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ThemeContext } from "./theme-context";
import type { ThemeMode } from "./theme-context";

const STORAGE_KEY = "mangashadow-theme";

function getInitialMode(): ThemeMode {
  const storedMode = window.localStorage.getItem(STORAGE_KEY);
  if (storedMode === "dark" || storedMode === "light") {
    return storedMode;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
    document.documentElement.style.colorScheme = mode;
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      toggleMode: () => {
        setMode((previousMode) => (previousMode === "dark" ? "light" : "dark"));
      },
    }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
