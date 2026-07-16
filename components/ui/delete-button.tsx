"use client";

import { useActionState } from "react";
import { Button } from "./button";

export type DeleteActionState = { error?: string } | null;

// Server Actions that throw a plain Error get their message redacted by
// Next.js in production builds (only the digest survives to the client),
// which turns an expected, guarded failure (e.g. "board still has tickets")
// into a blank crash screen. Returning { error } instead — read here via
// useActionState — sidesteps that redaction entirely, since it's just a
// normal serialized return value, not a thrown exception.
export function DeleteButton({
  action,
  label = "Delete",
}: {
  action: (prevState: DeleteActionState, formData: FormData) => Promise<DeleteActionState>;
  label?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      <Button type="submit" variant="danger" size="sm" disabled={isPending}>
        {isPending ? "Deleting…" : label}
      </Button>
      {state?.error && <p className="max-w-[280px] text-right text-[12px] text-red">{state.error}</p>}
    </form>
  );
}
