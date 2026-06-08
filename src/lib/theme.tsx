import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
type Ctx = { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void };

const ThemeCtx = createContext<Ctx | null>(null);

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

function getBrowserTheme(): Theme {
  if (typeof window === "undefined") return "light";

  try {
    const stored = window.localStorage.getItem("theme");
    if (isTheme(stored)) return stored;

    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(getBrowserTheme());
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;

    document.documentElement.classList.toggle("dark", theme === "dark");

    try {
      window.localStorage.setItem("theme", theme);
    } catch {
      // Storage can be unavailable in private browsing or embedded previews.
    }
  }, [theme]);

  return (
    <ThemeCtx.Provider
      value={{ theme, setTheme, toggle: () => setTheme((current) => (current === "dark" ? "light" : "dark")) }}
    >
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
