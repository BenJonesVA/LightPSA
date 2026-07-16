"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function TimerControl({
  openTimerStart,
  onStart,
  onStop,
}: {
  openTimerStart: string | null;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!openTimerStart) return;
    const startMs = new Date(openTimerStart).getTime();
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [openTimerStart]);

  if (!openTimerStart) {
    return (
      <form action={onStart}>
        <Button type="submit" variant="secondary" size="sm">
          ▶ Start timer
        </Button>
      </form>
    );
  }

  const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");

  return (
    <form action={onStop} className="flex items-center gap-2">
      <span className="font-mono text-[12.5px] text-fg">
        {minutes}:{seconds}
      </span>
      <Button type="submit" variant="primary" size="sm">
        ■ Stop &amp; log
      </Button>
    </form>
  );
}
