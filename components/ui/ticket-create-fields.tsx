"use client";

import { useState } from "react";
import type { AssetFieldDef } from "@/lib/asset-fields";
import { MarkdownEditor } from "./markdown-editor";

export type TicketCategoryOption = { id: string; name: string; fields: AssetFieldDef[] };
export type TicketTemplateOption = {
  id: string;
  name: string;
  titleTemplate: string;
  descriptionTemplate: string;
  priority: string;
  categoryId: string | null;
};

const fieldClass = "mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg";

// Owns title/description/priority/category (+ category-driven custom fields)
// together so picking a template can prefill all of them at once. All values
// still submit as plain named form fields on the surrounding Server Action
// form — this component has no submit handler of its own, same pattern as
// AssetCategoryFields/CannedResponsePicker.
export function TicketCreateFields({
  categories,
  templates,
}: {
  categories: TicketCategoryOption[];
  templates: TicketTemplateOption[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [categoryId, setCategoryId] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  // Bumped on template apply to force MarkdownEditor to remount with the new
  // description as its defaultValue — it manages its own value internally
  // once mounted, so this is the only way to push a new value into it.
  const [descriptionKey, setDescriptionKey] = useState(0);

  const fields = categories.find((c) => c.id === categoryId)?.fields ?? [];

  function applyTemplate(id: string) {
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setTitle(template.titleTemplate);
    setDescription(template.descriptionTemplate);
    setPriority(template.priority);
    setCategoryId(template.categoryId ?? "");
    setCustomValues({});
    setDescriptionKey((k) => k + 1);
  }

  return (
    <>
      {templates.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-fg-muted">Start from template</label>
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) applyTemplate(e.target.value);
              e.target.value = "";
            }}
            className={fieldClass}
          >
            <option value="">— Select a template —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-fg-muted">Title</label>
        <input
          type="text"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={fieldClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-fg-muted">Description</label>
        <MarkdownEditor key={descriptionKey} name="description" defaultValue={description} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-fg-muted">Priority</label>
          <select
            name="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={fieldClass}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="EMERGENCY">Emergency</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-muted">Category</label>
          <select
            name="categoryId"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setCustomValues({});
            }}
            className={fieldClass}
          >
            <option value="">None</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-fg-muted">
              {field.label}
              {field.required ? " *" : ""}
            </label>
            {field.type === "select" ? (
              <select
                name={`cf__${field.key}`}
                required={field.required}
                value={customValues[field.key] ?? ""}
                onChange={(e) => setCustomValues((v) => ({ ...v, [field.key]: e.target.value }))}
                className={fieldClass}
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
                value={customValues[field.key] ?? ""}
                onChange={(e) => setCustomValues((v) => ({ ...v, [field.key]: e.target.value }))}
                className={fieldClass}
              />
            )}
          </div>
        ))}
      </div>
    </>
  );
}
