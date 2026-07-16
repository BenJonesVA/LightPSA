import Link from "next/link";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { createAssetCategory, renameAssetCategory, deleteAssetCategory } from "./actions";

type AssetCategoryRow = { id: string; name: string; parentId: string | null };

const inputClass =
  "rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-focus";

function buildChildrenMap(categories: AssetCategoryRow[]) {
  const map = new Map<string | null, AssetCategoryRow[]>();
  for (const category of categories) {
    const list = map.get(category.parentId) ?? [];
    list.push(category);
    map.set(category.parentId, list);
  }
  return map;
}

function ParentSelect({
  categories,
  excludeId,
  defaultValue,
}: {
  categories: AssetCategoryRow[];
  excludeId?: string;
  defaultValue: string;
}) {
  return (
    <select name="parentId" defaultValue={defaultValue} className={inputClass}>
      <option value="">— top level —</option>
      {categories
        .filter((c) => c.id !== excludeId)
        .map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
    </select>
  );
}

function AssetCategoryNode({
  category,
  childrenMap,
  allCategories,
}: {
  category: AssetCategoryRow;
  childrenMap: Map<string | null, AssetCategoryRow[]>;
  allCategories: AssetCategoryRow[];
}) {
  const children = childrenMap.get(category.id) ?? [];
  const deleteCategoryForId = deleteAssetCategory.bind(null, category.id);

  return (
    <div className="flex flex-col gap-2">
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <form
            action={renameAssetCategory.bind(null, category.id)}
            className="flex flex-1 flex-wrap items-center gap-2"
          >
            <input
              type="text"
              name="name"
              required
              defaultValue={category.name}
              className={`min-w-[160px] flex-1 ${inputClass}`}
            />
            <ParentSelect
              categories={allCategories}
              excludeId={category.id}
              defaultValue={category.parentId ?? ""}
            />
            <Button type="submit" variant="primary" size="sm">
              Save
            </Button>
          </form>
          <Link href={`/admin/asset-categories/${category.id}/fields`}>
            <Button type="button" variant="secondary" size="sm">
              Fields
            </Button>
          </Link>
          <DeleteButton action={deleteCategoryForId} label="Delete" />
        </div>
      </Card>
      {children.length > 0 && (
        <div className="ml-6 flex flex-col gap-2">
          {children.map((child) => (
            <AssetCategoryNode
              key={child.id}
              category={child}
              childrenMap={childrenMap}
              allCategories={allCategories}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default async function AssetCategoriesAdminPage() {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const categories = await prisma.assetCategory.findMany({ orderBy: { name: "asc" } });
  const childrenMap = buildChildrenMap(categories);
  const topLevel = childrenMap.get(null) ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-fg">Asset Categories</h1>
        <p className="mt-[3px] text-[13.5px] text-fg-muted">
          Organize the asset taxonomy used across clients&apos; assets into a hierarchy.
        </p>
      </div>

      <Card className="p-4">
        <form action={createAssetCategory} className="flex flex-wrap items-end gap-2">
          <label className="block flex-1">
            <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">
              Category name
            </span>
            <input
              type="text"
              name="name"
              required
              className={`w-full min-w-[160px] ${inputClass}`}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Parent</span>
            <ParentSelect categories={categories} defaultValue="" />
          </label>
          <Button type="submit" variant="primary" size="sm">
            Add category
          </Button>
        </form>
      </Card>

      <div className="flex flex-col gap-2">
        {topLevel.map((category) => (
          <AssetCategoryNode
            key={category.id}
            category={category}
            childrenMap={childrenMap}
            allCategories={categories}
          />
        ))}
        {categories.length === 0 ? (
          <Card className="p-8 text-center text-fg-subtle">No asset categories yet.</Card>
        ) : null}
      </div>
    </div>
  );
}
