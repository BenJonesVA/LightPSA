import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { parseFieldSchema } from "@/lib/asset-fields";
import { Card } from "@/components/ui/card";
import { updateAssetCategoryFieldSchema } from "../../actions";
import { FieldSchemaEditor } from "../../field-schema-editor";

export default async function AssetCategoryFieldsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const { id } = await params;

  const category = await prisma.assetCategory.findUnique({ where: { id } });
  if (!category) {
    notFound();
  }

  const updateForCategory = updateAssetCategoryFieldSchema.bind(null, category.id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <Link href="/admin/asset-categories" className="text-[12.5px] text-accent hover:underline">
          ← Asset Categories
        </Link>
        <h1 className="mt-1 text-[24px] font-bold tracking-tight text-fg">{category.name} — Fields</h1>
        <p className="mt-[3px] text-[13.5px] text-fg-muted">
          Custom fields assets in this category present on their create/edit forms.
        </p>
      </div>

      <Card className="p-4">
        <FieldSchemaEditor action={updateForCategory} initialFields={parseFieldSchema(category.fieldSchema)} />
      </Card>
    </div>
  );
}
