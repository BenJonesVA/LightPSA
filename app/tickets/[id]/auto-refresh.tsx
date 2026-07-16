"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 20_000;

/**
 * Periodically calls router.refresh() so the ticket detail page picks up
 * server-side changes (new comments, status updates from other users, etc.)
 * without requiring a full page reload.
 *
 * Pauses while focus is anywhere inside a text input/textarea on the page,
 * so an in-flight refresh doesn't clobber a comment/time-log/expense form
 * the user is actively typing into.
 */
export function AutoRefresh() {
  const router = useRouter();
  const isTypingRef = useRef(false);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "TEXTAREA" || tag === "INPUT" || target.isContentEditable;
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (isEditableTarget(event.target)) {
        isTypingRef.current = true;
      }
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (isEditableTarget(event.target)) {
        isTypingRef.current = false;
      }
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    const id = setInterval(() => {
      if (isTypingRef.current) return;
      router.refresh();
    }, REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(id);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, [router]);

  return null;
}
