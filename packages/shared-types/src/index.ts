// Shared TypeScript types for Personal Data Firewall
// Used by both the Chrome extension and the AWS backend

// ─── Data Categories ─────────────────────────────────────────────────────────

export type DataCategory =
  | "basic_personal"
  | "contact"
  | "location"
  | "identity"
  | "financial"
  | "professional"
  | "health"
  | "sensitive_other"
  | "consent"
  | "unknown";

export type Sensitivity = "low" | "medium" | "high" | "unknown";

export type Requirement = "required" | "optional" | "unknown";

// ─── Form Field Types ─────────────────────────────────────────────────────────

export interface FormField {
  id: string;
  name?: string;
  label?: string;
  placeholder?: string;
  type: string;
  autocomplete?: string;
  required: boolean;
  disabled: boolean;
  visible: boolean;
  formId?: string;
  selector: string;
  context?: string; // nearby public text, NOT user-entered values
}

export interface ClassifiedField {
  id: string;
  fieldId: string;
  category: DataCategory;
  sensitivity: Sensitivity;
  requirement: Requirement;
  confidence: number;
  reason?: string;
}

// ─── Privacy Findings ─────────────────────────────────────────────────────────

export type FindingType =
  | "collection"
  | "purpose"
  | "marketing"
  | "advertising"
  | "third_party_sharing"
  | "service_provider"
  | "sale"
  | "retention"
  | "deletion"
  | "consent"
  | "tracking"
  | "cookies"
  | "data_request"
  | "other";

export type Severity = "info" | "attention" | "warning";

export interface EvidenceRef {
  text: string;
  sourceChunkId?: string;
  sourceUrl: string;
  section?: string;
}

export interface PrivacyFinding {
  id: string;
  fieldId: string;
  type: FindingType;
  severity: Severity;
  claim: string;
  evidence: EvidenceRef;
  confidence: number;
}

// ─── Disclosure Preview ───────────────────────────────────────────────────────

export interface DisclosureField {
  fieldId: string;
  label: string;
  category: DataCategory;
  sensitivity: Sensitivity;
  requirement: Requirement;
  selected: boolean;
  vaultKey?: string; // key in local vault to fill this field
  selector?: string; // CSS selector locating the field on the page
}

export interface DisclosurePreview {
  domain: string;
  companyName?: string;
  fields: DisclosureField[];
  findings: PrivacyFinding[];
  policyUrl?: string;
  termsUrl?: string;
  generatedAt: string;
  requestId?: string;
}

// ─── Disclosure Events (stored locally) ──────────────────────────────────────

export interface DisclosureEvent {
  id: string;
  domain: string;
  pageUrl: string;
  timestamp: string;
  fields: {
    fieldId: string;
    category: DataCategory;
    sensitivity: Sensitivity;
  }[];
  policyFindings: string[]; // finding IDs
  findingsSummary: PrivacyFinding[]; // stored for the record
  userConfirmed: boolean;
  fillMode: "minimum" | "full" | "manual";
}

// ─── Company Profile ──────────────────────────────────────────────────────────

export interface CompanyProfile {
  domain: string;
  name?: string;
  firstSeen: string;
  lastInteraction: string;
  sharedCategories: DataCategory[];
  disclosureCount: number;
  privacyPolicyUrl?: string;
  termsUrl?: string;
  deletionUrl?: string;
  dataRequestUrl?: string;
  pathways?: DataControlPathway[];
}

// ─── Data Control Pathways ────────────────────────────────────────────────────

export type PathwayType =
  | "account_deletion"
  | "data_deletion"
  | "data_request"
  | "account_settings"
  | "privacy_contact";

export interface DataControlPathway {
  type: PathwayType;
  url: string;
  sourceUrl: string;
  description?: string;
  evidence?: string;
}

// ─── Policy Document ──────────────────────────────────────────────────────────

export type PolicyDocumentType =
  | "privacy_policy"
  | "terms"
  | "cookie_policy"
  | "data_request"
  | "deletion"
  | "other";

export interface PolicyDocument {
  id: string;
  domain: string;
  url: string;
  title: string;
  content: string;
  contentHash: string;
  fetchedAt: string;
  documentType: PolicyDocumentType;
}

export interface PolicyChunk {
  id: string;
  documentId: string;
  heading?: string;
  text: string;
  order: number;
}

// ─── Vault Types ──────────────────────────────────────────────────────────────

export interface VaultProfile {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  jobTitle?: string;
  company?: string;
  website?: string;
}

// ─── API Request/Response Types ───────────────────────────────────────────────

export interface FormAnalyzeRequest {
  domain: string;
  fields: Pick<FormField, "id" | "name" | "label" | "placeholder" | "type" | "autocomplete" | "required">[];
}

export interface FormAnalyzeResponse {
  requestId: string;
  fields: ClassifiedField[];
}

export interface PolicyDiscoverRequest {
  url: string;
  domain: string;
}

export interface PolicyDiscoverResponse {
  privacyPolicy: { url: string } | null;
  terms: { url: string } | null;
  deletion: { url: string } | null;
  dataRequest: { url: string } | null;
}

export interface PolicyAnalyzeRequest {
  domain: string;
  policyUrl: string;
  requestedFields: Pick<ClassifiedField, "id" | "category" | "sensitivity">[];
}

export interface PolicyAnalyzeResponse {
  status: "success" | "no_relevant_evidence_found" | "policy_unavailable" | "error";
  findings: PrivacyFinding[];
  policyUrl?: string;
}

export interface CompanyPathwaysRequest {
  domain: string;
  pageUrl: string;
}

export interface CompanyPathwaysResponse {
  status: "success" | "not_found";
  pathways: DataControlPathway[];
}

// ─── Chrome Extension Message Types ──────────────────────────────────────────

export type ExtensionMessageType =
  | "FORM_DETECTED"
  | "GET_ANALYSIS"
  | "ANALYSIS_READY"
  | "FILL_FIELDS"
  | "RECORD_DISCLOSURE"
  | "GET_DISCLOSURE_PREVIEW"
  | "CLEAR_SESSION"
  | "TRIGGER_SCAN"
  | "OPEN_POPUP";

export interface ExtensionMessage<T = unknown> {
  type: ExtensionMessageType;
  payload?: T;
  tabId?: number;
}

export interface FormDetectedPayload {
  domain: string;
  pageUrl: string;
  pageTitle: string;
  fields: FormField[];
  privacyLinks: { text: string; url: string }[];
}

export interface FillFieldsPayload {
  fields: { selector: string; value: string }[];
}
