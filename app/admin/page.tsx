import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/rbac";
import { Card } from "@/components/ui/card";

const SECTIONS: { href: string; label: string; description: string; adminOnly?: boolean }[] = [
  {
    href: "/admin/branding",
    label: "Branding",
    description: "Company name, tagline, and logo shown across the app and sign-in page.",
  },
  {
    href: "/admin/categories",
    label: "Categories",
    description: "Ticket taxonomy used on tickets and knowledge base articles.",
  },
  {
    href: "/admin/canned-responses",
    label: "Canned Responses",
    description: "Reusable reply templates available when responding to tickets.",
  },
  {
    href: "/boards",
    label: "Boards",
    description: "Ticket boards — create, rename, and activate/deactivate.",
  },
  {
    href: "/admin/users",
    label: "Users",
    description: "Staff accounts, roles, and access.",
    adminOnly: true,
  },
  {
    href: "/admin/sla",
    label: "SLA Policies",
    description: "Response and resolution targets per ticket priority.",
  },
  {
    href: "/automation",
    label: "Automation",
    description: "IFTTT-style rules that react to ticket events.",
  },
  {
    href: "/billing",
    label: "Billing",
    description: "Contracts, rates, and invoice export.",
  },
];

export default async function AdminHubPage() {
  const user = await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const sections = SECTIONS.filter((s) => !s.adminOnly || user.role === UserRole.ADMIN);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-fg">Admin</h1>
        <p className="mt-[3px] text-[13.5px] text-fg-muted">
          Configure and customize this PSA.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {sections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full p-4 transition-colors hover:bg-surface-2">
              <div className="text-[14.5px] font-semibold text-fg">{section.label}</div>
              <p className="mt-1 text-[12.5px] text-fg-muted">{section.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
