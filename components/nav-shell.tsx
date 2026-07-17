import Link from "next/link";
import { Permission, UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { getSettings } from "@/lib/settings";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { DensityToggle } from "@/components/density-toggle";

function workspaceLinks(isEnterprise: boolean) {
  return [
    { href: "/", label: "Dashboard" },
    { href: "/tickets", label: "Tickets" },
    { href: "/boards", label: "Boards" },
    { href: "/clients", label: isEnterprise ? "Departments" : "Clients" },
    { href: "/assets", label: "Assets" },
    { href: "/kb", label: "Knowledge Base" },
    { href: "/schedule", label: "Schedule" },
  ];
}

// Permissions that unlock at least one card on the /admin hub (see that
// page's SECTIONS) — everything except MANAGE_CLIENTS/MANAGE_ASSETS/
// VIEW_REPORTS, which are reachable through their own nav links instead and
// have no hub-only destination. Showing the "Admin" link for those three
// alone would be a dead end: the hub would filter to zero cards and bounce
// to /unauthorized.
const HUB_PERMISSIONS: Permission[] = [
  Permission.MANAGE_BOARDS,
  Permission.MANAGE_CATEGORIES,
  Permission.MANAGE_CANNED_RESPONSES,
  Permission.MANAGE_BRANDING,
  Permission.MANAGE_USERS,
  Permission.MANAGE_SLA,
  Permission.MANAGE_AUTOMATION,
  Permission.MANAGE_BILLING,
];

// Additive: a link shows for ADMIN/MANAGER as before, or for anyone else who
// holds the specific permission that page is gated by (see lib/rbac.ts's
// requirePermission and app/admin/page.tsx's SECTIONS for the matching
// gates) — a granted permission with no way to navigate to it would be a
// dead end.
function manageLinks(isEnterprise: boolean, role: UserRole | undefined, permissions: Permission[]) {
  const isManager = role === UserRole.ADMIN || role === UserRole.MANAGER;
  const has = (permission: Permission) => isManager || permissions.includes(permission);

  const links = [];
  if (isManager || HUB_PERMISSIONS.some((p) => permissions.includes(p))) {
    links.push({ href: "/admin", label: "Admin" });
  }
  if (!isEnterprise && has(Permission.MANAGE_BILLING)) links.push({ href: "/billing", label: "Billing" });
  if (has(Permission.MANAGE_AUTOMATION)) links.push({ href: "/automation", label: "Automation" });
  if (has(Permission.MANAGE_SLA)) links.push({ href: "/admin/sla", label: "SLA Policies" });
  if (has(Permission.MANAGE_CATEGORIES)) links.push({ href: "/admin/categories", label: "Categories" });
  if (has(Permission.VIEW_REPORTS)) links.push({ href: "/reports", label: "Reports" });
  return links;
}

const CLIENT_NAV_LINKS = [
  { href: "/portal", label: "Portal" },
  { href: "/portal/tickets", label: "My Tickets" },
  { href: "/portal/kb", label: "Knowledge Base" },
];

function Logomark({ logoUrl }: { logoUrl?: string | null }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt="" className="h-6 w-6 flex-none rounded-[7px] object-contain" />
    );
  }
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
  const permissions = session.user.permissions ?? [];
  const canSeeAdmin = session.user.role === "ADMIN" || session.user.role === "MANAGER" || permissions.length > 0;
  const settings = await getSettings();
  const logoUrl = settings.logoMimeType ? `/api/branding/logo?v=${settings.updatedAt.getTime()}` : null;
  const isEnterprise = settings.orgMode === "ENTERPRISE";

  if (isClient) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <header className="sticky top-0 z-50 border-b border-border bg-surface shadow">
          <div className="mx-auto flex max-w-3xl items-center gap-6 px-6 py-3">
            <div className="flex items-center gap-2">
              <Logomark logoUrl={logoUrl} />
              <span className="text-[15px] font-bold tracking-tight text-fg">{settings.companyName}</span>
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
          <Logomark logoUrl={logoUrl} />
          <span className="text-[15px] font-bold tracking-tight text-fg">{settings.companyName}</span>
        </div>
        <NavGroup label="Workspace" links={workspaceLinks(isEnterprise)} />
        {canSeeAdmin && (
          <NavGroup label="Manage" links={manageLinks(isEnterprise, session.user.role, permissions)} />
        )}
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
            <DensityToggle />
            <ThemeToggle />
          </div>
        </div>
        <main className="flex-1 p-[22px]">{children}</main>
      </div>
    </div>
  );
}
