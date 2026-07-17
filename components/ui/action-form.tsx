"use client";

import { useActionState } from "react";

export type FormActionState = { error?: string } | null;

// Same rationale as delete-button.tsx: a thrown Error's message is redacted
// by Next.js in production builds, so a guarded validation failure (e.g.
// "that email is already in use") would otherwise bounce the user to the
// generic app/error.tsx screen instead of showing an inline message next to
// their still-filled-in form. Returning { error } and reading it via
// useActionState sidesteps the redaction and keeps the user's input intact.
export function ActionForm({
  action,
  children,
  className,
  encType,
}: {
  action: (prevState: FormActionState, formData: FormData) => Promise<FormActionState>;
  children: React.ReactNode;
  className?: string;
  encType?: string;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className={className} encType={encType}>
      {state?.error && (
        <p className="mb-4 rounded-md bg-red-bg px-3 py-2 text-[13px] text-red">{state.error}</p>
      )}
      {children}
    </form>
  );
}
