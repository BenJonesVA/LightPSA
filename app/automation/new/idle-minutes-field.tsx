"use client";

import { useState } from "react";

const INPUT_CLASS =
  "mt-1.5 block w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-focus";
const LABEL_CLASS = "block text-[12.5px] font-medium text-fg-muted";

// The idle-minutes input only applies to (and is only required for) the
// IDLE_TIME_EXCEEDED trigger. Kept as one client component so the two fields
// can share the selected-trigger state — the server action re-validates this
// requirement independently either way (see app/automation/actions.ts), this
// is just UX.
export function IdleMinutesField() {
  const [trigger, setTrigger] = useState("TICKET_CREATED");
  const isIdle = trigger === "IDLE_TIME_EXCEEDED";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="triggerType" className={LABEL_CLASS}>
          Trigger
        </label>
        <select
          id="triggerType"
          name="triggerType"
          required
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          className={INPUT_CLASS}
        >
          <option value="TICKET_CREATED">Ticket created</option>
          <option value="STATUS_CHANGED">Status changed</option>
          <option value="PRIORITY_ESCALATED">Priority escalated</option>
          <option value="IDLE_TIME_EXCEEDED">Idle time exceeded</option>
        </select>
        {isIdle && (
          <p className="mt-1.5 text-xs text-fg-subtle">
            Checked every 15 minutes by a scheduled sweep (see /api/cron/idle-sweep) — not instant.
          </p>
        )}
      </div>

      {isIdle && (
        <div>
          <label htmlFor="conditionIdleMinutes" className={LABEL_CLASS}>
            Idle threshold (minutes)
          </label>
          <input
            id="conditionIdleMinutes"
            name="conditionIdleMinutes"
            type="number"
            min={1}
            step={1}
            required
            className={`${INPUT_CLASS} w-40`}
            placeholder="e.g. 60"
          />
          <p className="mt-1.5 text-xs text-fg-subtle">
            Fires once a matching ticket has gone this long since its last update, then resets
            — it won&apos;t fire again until the ticket goes idle for this long a second time.
          </p>
        </div>
      )}
    </div>
  );
}
