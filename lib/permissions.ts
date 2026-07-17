import { Permission } from "@prisma/client";
import type { orgLabels } from "@/lib/settings";

type Labels = (typeof orgLabels)[keyof typeof orgLabels];

// Labels are threaded through rather than baked in — "Clients" reads
// "Departments" in enterprise mode everywhere else in the UI, this catalog
// shouldn't be the one place that doesn't.
export function getPermissionCatalog(labels: Labels): { key: Permission; label: string; description: string }[] {
  return [
    {
      key: Permission.MANAGE_USERS,
      label: "Manage users",
      description: "Create, edit, and deactivate staff accounts. Normally ADMIN-only — grant with care.",
    },
    {
      key: Permission.MANAGE_BILLING,
      label: "Manage billing",
      description: "View and export the billing/invoicing queue.",
    },
    {
      key: Permission.MANAGE_BOARDS,
      label: "Manage boards",
      description: "Create, edit, and delete ticket boards.",
    },
    {
      key: Permission.MANAGE_CLIENTS,
      label: `Manage ${labels.clients.toLowerCase()}`,
      description: `Create and edit ${labels.clients.toLowerCase()} and their ${labels.contacts.toLowerCase()}.`,
    },
    {
      key: Permission.MANAGE_ASSETS,
      label: "Manage assets",
      description: "Create, edit, and delete assets.",
    },
    {
      key: Permission.MANAGE_CATEGORIES,
      label: "Manage categories",
      description: "Edit the ticket category and asset category hierarchies.",
    },
    {
      key: Permission.MANAGE_AUTOMATION,
      label: "Manage automation rules",
      description: "Create and toggle automation rules.",
    },
    {
      key: Permission.MANAGE_SLA,
      label: "Manage SLA policies",
      description: "Edit response/resolution time targets per priority.",
    },
    {
      key: Permission.MANAGE_CANNED_RESPONSES,
      label: "Manage canned responses",
      description: "Create and edit reusable reply templates.",
    },
    {
      key: Permission.MANAGE_BRANDING,
      label: "Manage branding",
      description: "Edit company name, logo, tagline, and org mode.",
    },
    {
      key: Permission.VIEW_REPORTS,
      label: "View reports",
      description: "Access the Reports dashboard (SLA compliance, utilization, CSAT, etc.).",
    },
  ];
}
