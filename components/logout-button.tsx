"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm font-medium text-fg-subtle hover:text-fg"
    >
      Sign out
    </button>
  );
}
