import type {
  FormField,
  ClassifiedField,
  DataCategory,
  Sensitivity,
  Requirement,
} from "@consent-ahead/shared-types";

// ─── Deterministic classification maps ───────────────────────────────────────

const AUTOCOMPLETE_MAP: Record<string, { category: DataCategory; sensitivity: Sensitivity }> = {
  name: { category: "basic_personal", sensitivity: "low" },
  "given-name": { category: "basic_personal", sensitivity: "low" },
  "additional-name": { category: "basic_personal", sensitivity: "low" },
  "family-name": { category: "basic_personal", sensitivity: "low" },
  "honorific-prefix": { category: "basic_personal", sensitivity: "low" },
  "honorific-suffix": { category: "basic_personal", sensitivity: "low" },
  nickname: { category: "basic_personal", sensitivity: "low" },
  email: { category: "contact", sensitivity: "medium" },
  username: { category: "basic_personal", sensitivity: "low" },
  tel: { category: "contact", sensitivity: "medium" },
  "tel-national": { category: "contact", sensitivity: "medium" },
  "tel-area-code": { category: "contact", sensitivity: "medium" },
  "street-address": { category: "location", sensitivity: "high" },
  "address-line1": { category: "location", sensitivity: "high" },
  "address-line2": { category: "location", sensitivity: "high" },
  "address-level1": { category: "location", sensitivity: "high" },
  "address-level2": { category: "location", sensitivity: "high" },
  "postal-code": { category: "location", sensitivity: "high" },
  country: { category: "location", sensitivity: "medium" },
  "country-name": { category: "location", sensitivity: "medium" },
  bday: { category: "identity", sensitivity: "high" },
  "bday-day": { category: "identity", sensitivity: "high" },
  "bday-month": { category: "identity", sensitivity: "high" },
  "bday-year": { category: "identity", sensitivity: "high" },
  sex: { category: "identity", sensitivity: "high" },
  url: { category: "professional", sensitivity: "low" },
  photo: { category: "basic_personal", sensitivity: "medium" },
  organization: { category: "professional", sensitivity: "low" },
  "organization-title": { category: "professional", sensitivity: "low" },
  "cc-name": { category: "financial", sensitivity: "high" },
  "cc-number": { category: "financial", sensitivity: "high" },
  "cc-exp": { category: "financial", sensitivity: "high" },
  "cc-csc": { category: "financial", sensitivity: "high" },
  "cc-type": { category: "financial", sensitivity: "high" },
};

const INPUT_TYPE_MAP: Record<string, { category: DataCategory; sensitivity: Sensitivity }> = {
  email: { category: "contact", sensitivity: "medium" },
  tel: { category: "contact", sensitivity: "medium" },
  url: { category: "professional", sensitivity: "low" },
  date: { category: "identity", sensitivity: "high" },
  "datetime-local": { category: "identity", sensitivity: "high" },
  month: { category: "identity", sensitivity: "medium" },
};

// Keywords to match in field names/labels/placeholders
const KEYWORD_MAP: {
  patterns: RegExp;
  category: DataCategory;
  sensitivity: Sensitivity;
}[] = [
  { patterns: /\b(email|e-mail|mail)\b/i, category: "contact", sensitivity: "medium" },
  { patterns: /\b(phone|mobile|cell|tel|telephone)\b/i, category: "contact", sensitivity: "medium" },
  { patterns: /\b(first.?name|given.?name|forename)\b/i, category: "basic_personal", sensitivity: "low" },
  { patterns: /\b(last.?name|family.?name|surname)\b/i, category: "basic_personal", sensitivity: "low" },
  { patterns: /\b(full.?name|your.?name)\b/i, category: "basic_personal", sensitivity: "low" },
  { patterns: /\b(dob|d\.o\.b|date.?of.?birth|birthday|birth.?date|born)\b/i, category: "identity", sensitivity: "high" },
  { patterns: /\b(gender|sex)\b/i, category: "identity", sensitivity: "high" },
  { patterns: /\b(address|street|city|state|province|zip|postal|pincode|pin.?code)\b/i, category: "location", sensitivity: "high" },
  { patterns: /\b(country|nation)\b/i, category: "location", sensitivity: "medium" },
  { patterns: /\b(ssn|social.?security|national.?id|passport|aadhar|aadhaar|pan.?card|voter)\b/i, category: "identity", sensitivity: "high" },
  { patterns: /\b(income|salary|bank|credit|debit|card.?number|account.?number|ifsc|routing)\b/i, category: "financial", sensitivity: "high" },
  { patterns: /\b(company|employer|organization|workplace)\b/i, category: "professional", sensitivity: "low" },
  { patterns: /\b(job.?title|designation|position|role|occupation)\b/i, category: "professional", sensitivity: "low" },
  { patterns: /\b(resume|cv|portfolio)\b/i, category: "professional", sensitivity: "medium" },
  { patterns: /\b(age)\b/i, category: "identity", sensitivity: "medium" },
  { patterns: /^\s*(name|your name|student name|applicant name|participant name)\s*\*?\s*$/i, category: "basic_personal", sensitivity: "low" },
  { patterns: /\b(agree|consent|terms|newsletter|marketing|subscribe|opt.?in)\b/i, category: "consent", sensitivity: "low" },
  { patterns: /\b(health|medical|condition|diagnosis|disability|insurance)\b/i, category: "health", sensitivity: "high" },
];

// ─── Main Classification Function ─────────────────────────────────────────────

export function classifyField(
  field: Pick<FormField, "id" | "name" | "label" | "placeholder" | "type" | "autocomplete" | "required">
): Omit<ClassifiedField, "fieldId"> {
  // 1. Check autocomplete attribute (highest confidence)
  if (field.autocomplete) {
    const ac = field.autocomplete.toLowerCase().trim();
    if (AUTOCOMPLETE_MAP[ac]) {
      return {
        id: field.id,
        category: AUTOCOMPLETE_MAP[ac].category,
        sensitivity: AUTOCOMPLETE_MAP[ac].sensitivity,
        requirement: field.required ? "required" : "optional",
        confidence: 0.98,
        reason: `Classified via autocomplete="${ac}"`,
      };
    }
  }

  // 2. Check input type
  if (field.type && INPUT_TYPE_MAP[field.type]) {
    return {
      id: field.id,
      category: INPUT_TYPE_MAP[field.type].category,
      sensitivity: INPUT_TYPE_MAP[field.type].sensitivity,
      requirement: field.required ? "required" : "optional",
      confidence: 0.90,
      reason: `Classified via input type="${field.type}"`,
    };
  }

  // 3. Keyword matching across name, label, placeholder
  const searchText = [field.name, field.label, field.placeholder]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const { patterns, category, sensitivity } of KEYWORD_MAP) {
    if (patterns.test(searchText)) {
      return {
        id: field.id,
        category,
        sensitivity,
        requirement: field.required ? "required" : "optional",
        confidence: 0.80,
        reason: `Classified via keyword match in label/name/placeholder`,
      };
    }
  }

  // 4. Password fields: do NOT classify or autofill
  if (field.type === "password") {
    return {
      id: field.id,
      category: "unknown",
      sensitivity: "unknown",
      requirement: field.required ? "required" : "optional",
      confidence: 1.0,
      reason: "Password fields are never classified or autofilled",
    };
  }

  // 5. Checkbox / radio: likely consent
  if (field.type === "checkbox" || field.type === "radio") {
    return {
      id: field.id,
      category: "consent",
      sensitivity: "low",
      requirement: field.required ? "required" : "optional",
      confidence: 0.60,
      reason: "Checkbox likely represents a consent/agreement option",
    };
  }

  // 6. Unknown: needs AI fallback
  return {
    id: field.id,
    category: "unknown",
    sensitivity: "unknown",
    requirement: field.required ? "required" : "unknown",
    confidence: 0.30,
    reason: "Could not classify deterministically, AI analysis needed",
  };
}

// ─── Batch classification ─────────────────────────────────────────────────────

export function classifyFields(
  fields: Pick<FormField, "id" | "name" | "label" | "placeholder" | "type" | "autocomplete" | "required">[]
): ClassifiedField[] {
  return fields.map((f) => ({
    ...classifyField(f),
    fieldId: f.id,
  }));
}

export const classifyFieldsDeterministically = classifyFields;

// ─── Sensitivity helpers ──────────────────────────────────────────────────────

export function getSensitivityLevel(sensitivity: Sensitivity): number {
  return { low: 1, medium: 2, high: 3, unknown: 0 }[sensitivity] ?? 0;
}

export function getCategoryLabel(category: DataCategory): string {
  const labels: Record<DataCategory, string> = {
    basic_personal: "Basic Personal",
    contact: "Contact",
    location: "Location",
    identity: "Identity",
    financial: "Financial",
    professional: "Professional",
    health: "Health",
    sensitive_other: "Sensitive",
    consent: "Consent",
    unknown: "Unknown",
  };
  return labels[category] ?? "Unknown";
}

export function needsAIClassification(fields: ClassifiedField[]): boolean {
  return fields.some((f) => f.category === "unknown" && f.confidence < 0.5);
}

export { DataCategory, Sensitivity, Requirement };
