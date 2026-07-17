import Link from "next/link";
import { notFound } from "next/navigation";
import { Permission, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { parseFieldSchema } from "@/lib/asset-fields";
import { Card } from "@/components/ui/card";
import { updateCategoryFieldSchema } from "../../actions";
import { FieldSchemaEditor } from "../../../asset-categories/field-schema-editor";

export default async function CategoryFieldsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(Permission.MANAGE_CATEGORIES, UserRole.ADMIN, UserRole.MANAGER);

  const { id } = await params;

  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    notFound();
  }

  const updateForCategory = updateCategoryFieldSchema.bind(null, category.id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <Link href="/admin/categories" className="text-[12.5px] text-accent hover:underline">
          ← Ticket Categories
        </Link>
        <h1 className="mt-1 text-[24px] font-bold tracking-tight text-fg">{category.name} — Fields</h1>
        <p className="mt-[3px] text-[13.5px] text-fg-muted">
          Custom fields tickets in this category present on the New Ticket form.
        </p>
      </div>

      <Card className="p-4">
        <FieldSchemaEditor action={updateForCategory} initialFields={parseFieldSchema(category.fieldSchema)} />
      </Card>
    </div>
  );
}
