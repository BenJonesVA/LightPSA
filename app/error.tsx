"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Root error boundary — catches anything an action/page still throws instead
// of returning a result (most guarded delete/validation paths were converted
// to return { error } — see components/ui/delete-button.tsx — but this stays
// as a safety net for the rest, and for genuinely unexpected exceptions).
// Next.js redacts `error.message` for server-side errors in production
// builds, so this can't always show the real reason — `error.digest`
// correlates with the full message in the server logs.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 py-12">
      <Card className="w-full max-w-md rounded-2xl p-8">
        <div className="flex flex-col items-start gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-fg">Something went wrong</h1>
          <p className="text-sm text-fg-muted">
            {error.message || "An unexpected error occurred."}
          </p>
          {error.digest && (
            <p className="text-xs text-fg-subtle">Reference: {error.digest}</p>
          )}
          <div className="mt-2 flex gap-3">
            <Button variant="secondary" onClick={() => reset()}>
              Try again
            </Button>
            <a href="/">
              <Button variant="primary">Back to dashboard</Button>
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
