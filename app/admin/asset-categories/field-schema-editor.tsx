"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ASSET_FIELD_TYPES, type AssetFieldDef, type AssetFieldType } from "@/lib/asset-fields";

const inputClass =
  "rounded-md border border-border-strong bg-surface px-2.5 py-[6px] text-[13px] text-fg focus:outline-none focus:ring-2 focus:ring-focus";

type Row = AssetFieldDef & { optionsText?: string };

function toRows(fields: AssetFieldDef[]): Row[] {
  return fields.map((f) => ({ ...f, optionsText: (f.options ?? []).join(", ") }));
}

function toFieldDefs(rows: Row[]): AssetFieldDef[] {
  return rows.map(({ optionsText, ...field }) => ({
    ...field,
    ...(field.type === "select"
      ? { options: (optionsText ?? "").split(",").map((o) => o.trim()).filter(Boolean) }
      : {}),
  }));
}

export function FieldSchemaEditor({
  action,
  initialFields,
}: {
  action: (formData: FormData) => Promise<void>;
  initialFields: AssetFieldDef[];
}) {
  const [rows, setRows] = useState<Row[]>(toRows(initialFields));

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function addRow() {
    setRows((prev) => [...prev, { key: "", label: "", type: "text", required: false }]);
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="fieldSchema" value={JSON.stringify(toFieldDefs(rows))} />

      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <div key={index} className="rounded-lg border border-border-strong p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <input
                placeholder="key (e.g. ram_gb)"
                value={row.key}
                onChange={(e) => updateRow(index, { key: e.target.value })}
                className={inputClass}
              />
              <input
                placeholder="Label (e.g. RAM (GB))"
                value={row.label}
                onChange={(e) => updateRow(index, { label: e.target.value })}
                className={inputClass}
              />
              <select
                value={row.type}
                onChange={(e) => updateRow(index, { type: e.target.value as AssetFieldType })}
                className={inputClass}
              >
                {ASSET_FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-[12.5px] text-fg-muted">
                <input
                  type="checkbox"
                  checked={row.required}
                  onChange={(e) => updateRow(index, { required: e.target.checked })}
                  className="rounded border-border-strong accent-accent"
                />
                Required
              </label>
              <Button type="button" variant="danger" size="sm" onClick={() => removeRow(index)}>
                Remove
              </Button>
            </div>
            {row.type === "select" && (
              <input
                placeholder="Options, comma-separated"
                value={row.optionsText ?? ""}
                onChange={(e) => updateRow(index, { optionsText: e.target.value })}
                className={`mt-2 w-full ${inputClass}`}
              />
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed border-border-strong p-4 text-center text-[12.5px] text-fg-subtle">
            No custom fields yet for this category.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="secondary" size="sm" onClick={addRow}>
          + Add field
        </Button>
        <Button type="submit" variant="primary" size="sm">
          Save fields
        </Button>
      </div>
    </form>
  );
}
