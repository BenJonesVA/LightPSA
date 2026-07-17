import Link from "next/link";
import { redirect } from "next/navigation";
import { Permission, UserRole } from "@prisma/client";
import { requireStaff } from "@/lib/rbac";
import { isEnterpriseMode } from "@/lib/settings";
import { Card } from "@/components/ui/card";

type Section = {
  href: string;
  label: string;
  description: string;
  // Roles that see this card regardless of any granted permission. Defaults
  // to ADMIN/MANAGER — set explicitly (e.g. Users: [ADMIN]) to narrow it.
  roles?: UserRole[];
  // A permission that also unlocks this card, additively, for any role that
  // holds it (e.g. a TECHNICIAN granted MANAGE_SLA). Omit for cards that
  // must stay role-locked no matter what a permission group grants —
  // Permission Groups management itself is the one case that matters here,
  // since letting a permission unlock it would let a permissioned user grant
  // themselves more access than an ADMIN gave them.
  permission?: Permission;
  hideInEnterprise?: boolean;
};

const DEFAULT_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER];

const SECTIONS: Section[] = [
  {
    href: "/admin/branding",
    label: "Branding",
    description: "Company name, tagline, and logo shown across the app and sign-in page.",
    permission: Permission.MANAGE_BRANDING,
  },
  {
    href: "/admin/categories",
    label: "Categories",
    description: "Ticket taxonomy used on tickets and knowledge base articles.",
    permission: Permission.MANAGE_CATEGORIES,
  },
  {
    href: "/admin/asset-categories",
    label: "Asset Categories",
    description: "Asset taxonomy used across clients' assets.",
    permission: Permission.MANAGE_CATEGORIES,
  },
  {
    href: "/admin/canned-responses",
    label: "Canned Responses",
    description: "Reusable reply templates available when responding to tickets.",
    permission: Permission.MANAGE_CANNED_RESPONSES,
  },
  {
    href: "/boards",
    label: "Boards",
    description: "Ticket boards — create, rename, and activate/deactivate.",
    permission: Permission.MANAGE_BOARDS,
  },
  {
    href: "/admin/users",
    label: "Users",
    description: "Staff accounts, roles, and access.",
    roles: [UserRole.ADMIN],
    permission: Permission.MANAGE_USERS,
  },
  {
    href: "/admin/permission-groups",
    label: "Permission Groups",
    description: "Named bundles of extra capabilities, assignable to any user.",
    roles: [UserRole.ADMIN],
  },
  {
    href: "/admin/sla",
    label: "SLA Policies",
    description: "Response and resolution targets per ticket priority.",
    permission: Permission.MANAGE_SLA,
  },
  {
    href: "/automation",
    label: "Automation",
    description: "IFTTT-style rules that react to ticket events.",
    permission: Permission.MANAGE_AUTOMATION,
  },
  {
    href: "/billing",
    label: "Billing",
    description: "Contracts, rates, and invoice export.",
    permission: Permission.MANAGE_BILLING,
    hideInEnterprise: true,
  },
];

export default async function AdminHubPage() {
  const user = await requireStaff();

  const canSee = (section: Section) =>
    (section.roles ?? DEFAULT_ROLES).includes(user.role!) ||
    (section.permission !== undefined && (user.permissions?.includes(section.permission) ?? false));

  const isEnterprise = await isEnterpriseMode();

  const sections = SECTIONS.filter((s) => canSee(s) && (!s.hideInEnterprise || !isEnterprise));

  if (sections.length === 0) {
    redirect("/unauthorized");
  }

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
