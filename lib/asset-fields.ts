// Admin-defined custom fields per AssetCategory (AssetCategory.fieldSchema)
// and the values an individual Asset stores against them (Asset.customFields).
// Both are plain JSON columns — this module is the single place that knows
// their shape and does the untrusted-JSON → typed-value parsing.

export type AssetFieldType = "text" | "number" | "date" | "select";

export const ASSET_FIELD_TYPES: AssetFieldType[] = ["text", "number", "date", "select"];

export type AssetFieldDef = {
  key: string;
  label: string;
  type: AssetFieldType;
  required: boolean;
  options?: string[];
};

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export function isValidFieldKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

export function parseFieldSchema(value: unknown): AssetFieldDef[] {
  if (!Array.isArray(value)) return [];

  const seenKeys = new Set<string>();
  const fields: AssetFieldDef[] = [];

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const raw = entry as Record<string, unknown>;

    const key = typeof raw.key === "string" ? raw.key : "";
    const label = typeof raw.label === "string" ? raw.label : "";
    const type = ASSET_FIELD_TYPES.includes(raw.type as AssetFieldType)
      ? (raw.type as AssetFieldType)
      : null;

    if (!key || !label || !type || !isValidFieldKey(key) || seenKeys.has(key)) continue;
    seenKeys.add(key);

    const options = Array.isArray(raw.options)
      ? raw.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0)
      : undefined;

    fields.push({
      key,
      label,
      type,
      required: raw.required === true,
      ...(type === "select" ? { options: options ?? [] } : {}),
    });
  }

  return fields;
}

export function parseCustomFieldValues(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};

  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") result[key] = raw;
    else if (typeof raw === "number") result[key] = String(raw);
  }
  return result;
}

// Reads `cf__<key>` form fields for the given schema — the naming convention
// shared with components/ui/asset-category-fields.tsx, which renders the
// inputs with those names.
export function extractCustomFieldsFromFormData(
  formData: FormData,
  schema: AssetFieldDef[]
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of schema) {
    const raw = formData.get(`cf__${field.key}`);
    if (raw === null) continue;
    const trimmed = String(raw).trim();
    if (trimmed) result[field.key] = trimmed;
  }
  return result;
}

// Returns the first validation problem found, or null if the values satisfy
// the schema (required-ness, select options, numeric-ness of "number" fields).
export function validateCustomFieldValues(
  schema: AssetFieldDef[],
  values: Record<string, string>
): string | null {
  for (const field of schema) {
    const value = values[field.key];

    if (field.required && !value) {
      return `${field.label} is required`;
    }
    if (!value) continue;

    if (field.type === "number" && Number.isNaN(Number(value))) {
      return `${field.label} must be a number`;
    }
    if (field.type === "select" && field.options && !field.options.includes(value)) {
      return `${field.label} has an invalid value`;
    }
  }

  return null;
}
