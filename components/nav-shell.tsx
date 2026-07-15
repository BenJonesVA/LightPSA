import Link from "next/link";
import { auth } from "@/auth";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";

const WORKSPACE_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/tickets", label: "Tickets" },
  { href: "/boards", label: "Boards" },
  { href: "/clients", label: "Clients" },
  { href: "/kb", label: "Knowledge Base" },
];

const MANAGE_LINKS = [
  { href: "/billing", label: "Billing" },
  { href: "/automation", label: "Automation" },
  { href: "/admin/sla", label: "SLA Policies" },
  { href: "/reports", label: "Reports" },
];

const CLIENT_NAV_LINKS = [
  { href: "/portal", label: "Portal" },
  { href: "/portal/tickets", label: "My Tickets" },
  { href: "/portal/kb", label: "Knowledge Base" },
];

function Logomark() {
  return (
    <div className="flex h-6 w-6 flex-none items-center justify-center rounded-[7px] bg-gradient-to-br from-accent to-[#8f88ff]">
      <div className="h-[9px] w-[9px] rotate-45 rounded-sm bg-white" />
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function NavGroup({ label, links }: { label: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <div className="px-[10px] pb-[6px] pt-2 text-[10px] font-semibold uppercase tracking-[.09em] text-fg-subtle">
        {label}
      </div>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="flex items-center gap-[10px] rounded-lg px-[10px] py-2 text-[13px] font-medium text-fg-muted hover:bg-surface-3 hover:text-fg"
        >
          <span className="h-[7px] w-[7px] flex-none rounded-[2px] bg-fg-subtle" />
          {link.label}
        </Link>
      ))}
    </div>
  );
}

export async function NavShell({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    return <main className="min-h-screen bg-bg">{children}</main>;
  }

  const isClient = session.user.actorType === "CLIENT";
  const canSeeAdmin = session.user.role === "ADMIN" || session.user.role === "MANAGER";

  if (isClient) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <header className="sticky top-0 z-50 border-b border-border bg-surface shadow">
          <div className="mx-auto flex max-w-3xl items-center gap-6 px-6 py-3">
            <div className="flex items-center gap-2">
              <Logomark />
              <span className="text-[15px] font-bold tracking-tight text-fg">LightPSA</span>
            </div>
            <nav className="flex gap-2">
              {CLIENT_NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-[10px] py-[6px] text-[13px] font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <ThemeToggle />
              <span className="text-sm text-fg-subtle">{session.user.name}</span>
              <LogoutButton />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="flex w-[232px] flex-none flex-col border-r border-border bg-surface-2 p-3">
        <div className="flex items-center gap-2 px-2 pb-4 pt-1.5">
          <Logomark />
          <span className="text-[15px] font-bold tracking-tight text-fg">LightPSA</span>
        </div>
        <NavGroup label="Workspace" links={WORKSPACE_LINKS} />
        {canSeeAdmin && <NavGroup label="Manage" links={MANAGE_LINKS} />}
        <div className="mt-auto flex items-center gap-[9px] border-t border-border pt-[14px]">
          <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-violet text-[11px] font-semibold text-white">
            {initials(session.user.name ?? "?")}
          </div>
          <div className="min-w-0 flex-1 leading-[1.25]">
            <div className="truncate text-[12.5px] font-semibold text-fg">{session.user.name}</div>
            <div className="truncate text-[11px] text-fg-subtle">{session.user.role}</div>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 flex-none items-center gap-4 border-b border-border bg-surface px-[22px]">
          <div className="ml-auto flex items-center gap-[10px]">
            <ThemeToggle />
          </div>
        </div>
        <main className="flex-1 p-[22px]">{children}</main>
      </div>
    </div>
  );
}
