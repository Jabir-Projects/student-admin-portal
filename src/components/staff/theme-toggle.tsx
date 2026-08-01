"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const themeStorageKey = "sist-color-theme";

export function ThemeToggle() {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleTheme() {
    const root = document.documentElement;
    const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = nextTheme;
    root.style.colorScheme = nextTheme;
    try {
      localStorage.setItem(themeStorageKey, nextTheme);
    } catch {
      // The visual preference still applies when storage is unavailable.
    }
  }

  return (
    <button
      aria-label="Toggle light and dark theme"
      className="border-border bg-background text-foreground hover:bg-muted inline-flex size-10 items-center justify-center rounded-lg border transition-colors"
      disabled={!isHydrated}
      onClick={toggleTheme}
      title="Toggle light and dark theme"
      type="button"
    >
      <Moon aria-hidden="true" className="theme-icon-dark size-4.5" />
      <Sun aria-hidden="true" className="theme-icon-light size-4.5" />
    </button>
  );
}
