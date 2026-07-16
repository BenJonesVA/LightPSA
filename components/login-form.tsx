"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LoginForm({
  callbackUrl,
  error,
  portalTabLabel = "Client Portal",
}: {
  callbackUrl?: string;
  error?: string;
  portalTabLabel?: string;
}) {
  const [tab, setTab] = useState<"staff" | "client">("staff");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const providerId = tab === "staff" ? "staff-login" : "client-login";
    const defaultTarget = tab === "staff" ? "/" : "/portal";

    const result = await signIn(providerId, { email, password, redirect: false });
    setSubmitting(false);

    if (!result || result.error) {
      setFormError("Invalid email or password.");
      return;
    }

    window.location.href = callbackUrl || defaultTarget;
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-lg">
      <div className="mb-6 flex gap-2 rounded-xl bg-surface-2 p-1">
        <button
          type="button"
          onClick={() => setTab("staff")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "staff" ? "bg-surface text-fg shadow" : "text-fg-muted"
          }`}
        >
          Staff
        </button>
        <button
          type="button"
          onClick={() => setTab("client")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "client" ? "bg-surface text-fg shadow" : "text-fg-muted"
          }`}
        >
          {portalTabLabel}
        </button>
      </div>

      {(formError || error) && (
        <div className="mb-4 rounded-lg bg-red-bg px-3 py-2 text-sm text-red">
          {formError ?? "Invalid email or password."}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-fg-muted">Email</label>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-fg-muted">Password</label>
          <input
            name="password"
            type="password"
            required
            className="mt-1 w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
          />
        </div>
        <Button type="submit" variant="primary" disabled={submitting} className="w-full disabled:opacity-50">
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
