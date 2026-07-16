"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "psa-density";
type Density = "compact" | "scannable" | "spacious";
const ORDER: Density[] = ["compact", "scannable", "spacious"];
const LABEL: Record<Density, string> = {
  compact: "Compact",
  scannable: "Scannable",
  spacious: "Spacious",
};

export function DensityToggle() {
  const [density, setDensity] = useState<Density>("scannable");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-density");
    if (current === "compact" || current === "spacious") setDensity(current);
  }, []);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(density) + 1) % ORDER.length];
    if (next === "scannable") {
      document.documentElement.removeAttribute("data-density");
    } else {
      document.documentElement.setAttribute("data-density", next);
    }
    localStorage.setItem(STORAGE_KEY, next);
    setDensity(next);
  }

  return (
    <button
      onClick={cycle}
      className="flex items-center gap-[7px] rounded-[7px] border border-border bg-surface-2 px-[11px] py-[6px] text-[12.5px] font-medium text-fg-muted"
      title="Row density"
    >
      <span className="h-2 w-2 rounded-full bg-slate" />
      {LABEL[density]}
    </button>
  );
}
