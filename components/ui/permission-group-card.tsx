"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Permission } from "@prisma/client";
import { Card } from "./card";
import { Button } from "./button";
import { DeleteButton, type DeleteActionState } from "./delete-button";
import type { FormActionState } from "./action-form";

const inputClass =
  "rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-focus";

function PermissionCheckboxes({
  catalog,
  checked,
}: {
  catalog: { key: Permission; label: string; description: string }[];
  checked: Set<string>;
}) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {catalog.map((perm) => (
        <label key={perm.key} className="flex items-start gap-2.5 rounded-lg border border-border p-2.5 text-[12.5px]">
          <input
            type="checkbox"
            name="permissions"
            value={perm.key}
            defaultChecked={checked.has(perm.key)}
            className="mt-0.5 rounded border-border-strong accent-accent"
          />
          <span>
            <span className="block font-medium text-fg">{perm.label}</span>
            <span className="block text-fg-subtle">{perm.description}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className={`h-4 w-4 shrink-0 text-fg-subtle transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M5 7.5L10 12.5L15 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PermissionGroupCard({
  group,
  catalog,
  updateAction,
  deleteAction,
}: {
  group: { id: string; name: string; permissions: string[]; members: { user: { id: string; name: string | null } }[] };
  catalog: { key: Permission; label: string; description: string }[];
  updateAction: (prevState: FormActionState, formData: FormData) => Promise<FormActionState>;
  deleteAction: (prevState: DeleteActionState, formData: FormData) => Promise<DeleteActionState>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(updateAction, null);
  const wasPending = useRef(false);

  // Collapse the card back to summary view right after a save succeeds,
  // so the page doesn't stay cluttered with every group expanded.
  useEffect(() => {
    if (wasPending.current && !isPending && !state?.error) {
      setOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, state]);

  const memberCount = group.members.length;

  return (
    <Card className="p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-[14px] font-semibold text-fg">{group.name}</span>
        <span className="flex items-center gap-2 whitespace-nowrap text-[11.5px] text-fg-subtle">
          {memberCount === 0 ? "No members" : `${memberCount} member${memberCount === 1 ? "" : "s"}`}
          <ChevronIcon open={open} />
        </span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          <form action={formAction} className="flex flex-col gap-3">
            {state?.error && (
              <p className="rounded-md bg-red-bg px-3 py-2 text-[13px] text-red">{state.error}</p>
            )}
            <label className="block">
              <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Name</span>
              <input type="text" name="name" required defaultValue={group.name} className={`w-full ${inputClass}`} />
            </label>
            <PermissionCheckboxes catalog={catalog} checked={new Set(group.permissions)} />
            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="sm" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
          <div className="flex justify-end border-t border-border pt-3">
            <DeleteButton action={deleteAction} label="Delete group" />
          </div>
        </div>
      )}
    </Card>
  );
}
