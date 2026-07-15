"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "psa-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY, next);
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-[7px] rounded-[7px] border border-border bg-surface-2 px-[11px] py-[6px] text-[12.5px] font-medium text-fg-muted"
    >
      <span className="h-2 w-2 rounded-full bg-accent" />
      {theme === "light" ? "Light" : "Dark"}
    </button>
  );
}
