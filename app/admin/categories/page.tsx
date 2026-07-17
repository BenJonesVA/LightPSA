import { Permission, UserRole } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createCategory, renameCategory, deleteCategory } from "./actions";
import { ActionForm } from "@/components/ui/action-form";

type CategoryRow = { id: string; name: string; parentId: string | null };

const inputClass =
  "rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-focus";

function buildChildrenMap(categories: CategoryRow[]) {
  const map = new Map<string | null, CategoryRow[]>();
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
  categories: CategoryRow[];
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

function CategoryNode({
  category,
  childrenMap,
  allCategories,
}: {
  category: CategoryRow;
  childrenMap: Map<string | null, CategoryRow[]>;
  allCategories: CategoryRow[];
}) {
  const children = childrenMap.get(category.id) ?? [];

  return (
    <div className="flex flex-col gap-2">
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <ActionForm
            action={renameCategory.bind(null, category.id)}
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
          </ActionForm>
          <Link href={`/admin/categories/${category.id}/fields`}>
            <Button type="button" variant="secondary" size="sm">
              Fields
            </Button>
          </Link>
          <form action={deleteCategory.bind(null, category.id)}>
            <Button type="submit" variant="danger" size="sm">
              Delete
            </Button>
          </form>
        </div>
      </Card>
      {children.length > 0 && (
        <div className="ml-6 flex flex-col gap-2">
          {children.map((child) => (
            <CategoryNode
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

export default async function CategoriesAdminPage() {
  await requirePermission(Permission.MANAGE_CATEGORIES, UserRole.ADMIN, UserRole.MANAGER);

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  const childrenMap = buildChildrenMap(categories);
  const topLevel = childrenMap.get(null) ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-fg">Ticket Categories</h1>
        <p className="mt-[3px] text-[13.5px] text-fg-muted">
          Organize ticket and knowledge base categories into a hierarchy.
        </p>
      </div>

      <Card className="p-4">
        <ActionForm action={createCategory} className="flex flex-wrap items-end gap-2">
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
        </ActionForm>
      </Card>

      <div className="flex flex-col gap-2">
        {topLevel.map((category) => (
          <CategoryNode
            key={category.id}
            category={category}
            childrenMap={childrenMap}
            allCategories={categories}
          />
        ))}
        {categories.length === 0 ? (
          <Card className="p-8 text-center text-fg-subtle">No categories yet.</Card>
        ) : null}
      </div>
    </div>
  );
}
