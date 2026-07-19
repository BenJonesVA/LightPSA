"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Same poll cadence as app/tickets/[id]/auto-refresh.tsx's REFRESH_INTERVAL_MS
// — there's no push channel for notifications, so this is the mechanism that
// makes a new one show up without a manual reload.
const POLL_INTERVAL_MS = 20_000;

type NotificationDto = {
  id: string;
  ticketId: number | null;
  type: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      } catch {
        // Best-effort polling — a transient failure just means the bell
        // stays as it was until the next tick.
      }
    }

    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function markRead(notification: NotificationDto) {
    if (notification.readAt) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await fetch(`/api/notifications/${notification.id}/read`, { method: "POST" });
    } catch {
      // Optimistic update stands even if the write fails; the next poll
      // reconciles state from the server.
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center gap-[7px] rounded-[7px] border border-border bg-surface-2 px-[11px] py-[6px] text-[12.5px] font-medium text-fg-muted"
        title="Notifications"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
          <path
            d="M10 2.5c-2.1 0-3.8 1.7-3.8 3.8v1.9c0 .6-.2 1.2-.6 1.7l-.8 1c-.6.8 0 2 1 2h8.4c1 0 1.6-1.2 1-2l-.8-1c-.4-.5-.6-1.1-.6-1.7V6.3c0-2.1-1.7-3.8-3.8-3.8Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M8.3 15.8a1.7 1.7 0 0 0 3.4 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red px-[3px] text-[9.5px] font-semibold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[320px] rounded-[10px] border border-border bg-surface shadow-lg">
          <div className="border-b border-border px-3 py-2 text-[12px] font-semibold text-fg">Notifications</div>
          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-3 py-4 text-[12.5px] text-fg-subtle">No notifications yet.</div>
            ) : (
              notifications.map((n) => {
                const content = (
                  <div className="flex flex-col gap-[3px]">
                    <span className="text-[12.5px] leading-snug text-fg">{n.message}</span>
                    <span className="text-[10.5px] text-fg-subtle">{timeAgo(n.createdAt)}</span>
                  </div>
                );
                const rowClass = `flex items-start gap-2 border-b border-border px-3 py-[9px] last:border-b-0 hover:bg-surface-2 ${
                  n.readAt ? "" : "bg-accent-weak"
                }`;
                return n.ticketId ? (
                  <Link
                    key={n.id}
                    href={`/tickets/${n.ticketId}`}
                    onClick={() => markRead(n)}
                    className={rowClass}
                  >
                    {content}
                  </Link>
                ) : (
                  <button key={n.id} onClick={() => markRead(n)} className={`w-full text-left ${rowClass}`}>
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
