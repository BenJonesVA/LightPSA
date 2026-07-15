"use client";

import { useState } from "react";

type CannedResponseOption = { id: string; title: string; body: string };

export function CannedResponsePicker({
  cannedResponses,
  clientName,
  ticketId,
}: {
  cannedResponses: CannedResponseOption[];
  clientName: string;
  ticketId: number;
}) {
  const [body, setBody] = useState("");

  function applyTemplate(id: string) {
    const template = cannedResponses.find((c) => c.id === id);
    if (!template) return;
    const filled = template.body
      .split("{{client_name}}")
      .join(clientName)
      .split("{{ticket_id}}")
      .join(`TKT-${ticketId}`);
    setBody(filled);
  }

  return (
    <>
      {cannedResponses.length > 0 ? (
        <div>
          <label className="block text-xs font-medium text-fg-muted">
            Insert canned response
          </label>
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) applyTemplate(e.target.value);
              e.target.value = "";
            }}
            className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm text-fg"
          >
            <option value="">— Select a canned response —</option>
            {cannedResponses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <textarea
        name="body"
        required
        rows={3}
        placeholder="Add a comment…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
      />
    </>
  );
}
