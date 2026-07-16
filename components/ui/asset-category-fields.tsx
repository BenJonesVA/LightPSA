"use client";

import { useState } from "react";
import type { AssetFieldDef } from "@/lib/asset-fields";

export type AssetCategoryOption = {
  id: string;
  name: string;
  fields: AssetFieldDef[];
};

const selectClass =
  "w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg";

// Renders the category <select> plus whichever custom fields the currently
// selected category defines, all inside the surrounding <form> (a plain
// Server Action form — this component has no submit handler of its own).
// Category and field values are local state purely so switching category
// swaps the field set client-side without a round trip; the actual values
// still travel to the server as normal named form fields on submit.
export function AssetCategoryFields({
  categories,
  categoryLabel,
  initialCategoryId,
  initialValues = {},
}: {
  categories: AssetCategoryOption[];
  categoryLabel: string;
  initialCategoryId?: string;
  initialValues?: Record<string, string>;
}) {
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? categories[0]?.id ?? "");
  const [values, setValues] = useState<Record<string, string>>(initialValues);

  const fields = categories.find((c) => c.id === categoryId)?.fields ?? [];

  return (
    <>
      <div className="col-span-2 sm:col-span-1">
        <label className="mb-1 block text-[11px] font-medium text-fg-subtle">{categoryLabel}</label>
        <select
          name="categoryId"
          required
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setValues({});
          }}
          className={selectClass}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {fields.map((field) => (
        <div key={field.key} className="col-span-2 sm:col-span-1">
          <label className="mb-1 block text-[11px] font-medium text-fg-subtle">
            {field.label}
            {field.required ? " *" : ""}
          </label>
          {field.type === "select" ? (
            <select
              name={`cf__${field.key}`}
              required={field.required}
              value={values[field.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              className={selectClass}
            >
              <option value="">—</option>
              {(field.options ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
              name={`cf__${field.key}`}
              required={field.required}
              value={values[field.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              className={selectClass}
            />
          )}
        </div>
      ))}
    </>
  );
}
