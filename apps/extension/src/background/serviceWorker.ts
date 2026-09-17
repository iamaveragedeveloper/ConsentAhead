// Background Service Worker
// Orchestrates the full analysis pipeline:
//   Form detected → classify fields → discover policy → analyze policy → cache results
// NEVER stores personal vault data. NEVER auto-submits forms.

import { classifyFields } from "@consent-ahead/field-classifier";
import type {
  ExtensionMessage,
  FormDetectedPayload,
  DisclosurePreview,
  DisclosureField,
  FormAnalyzeResponse,
  PolicyDiscoverResponse,
  PolicyAnalyzeResponse,
  ClassifiedField,
} from "@consent-ahead/shared-types";

// ─── Configuration ────────────────────────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

// ─── Session Cache (cleared when service worker restarts) ─────────────────────

const sessionCache = new Map<string, DisclosurePreview>();

// ─── API Client ───────────────────────────────────────────────────────────────

async function callAPI<TReq, TRes>(endpoint: string, body: TReq): Promise<TRes | null> {
  if (!API_BASE_URL) return null; // offline mode

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.warn(`[DataFirewall] API ${endpoint} returned ${response.status}`);
      return null;
    }

    return await response.json() as TRes;
  } catch (err) {
    console.warn(`[DataFirewall] API call failed for ${endpoint}:`, err);
    return null;
  }
}

// ─── Sensitivity display name ─────────────────────────────────────────────────

function getSensitivityLabel(s: string): string {
  const map: Record<string, string> = {
    low: "Low sensitivity",
    medium: "Moderate sensitivity",
    high: "Sensitive",
    unknown: "Unknown",
  };
  return map[s] ?? "Unknown";
}

// ─── Main Analysis Pipeline ───────────────────────────────────────────────────

async function analyzeForm(payload: FormDetectedPayload): Promise<DisclosurePreview> {
  const { domain, pageUrl, fields, privacyLinks } = payload;
  const cacheKey = `${domain}:${pageUrl}`;

  // 1. Deterministic field classification (always runs, fast)
  const classified = classifyFields(
    fields.map((f) => ({
      id: f.id,
      name: f.name,
      label: f.label,
      placeholder: f.placeholder,
      type: f.type,
      autocomplete: f.autocomplete,
      required: f.required,
    }))
  );

  // 2. AI classification via API (if available, for unknown fields)
  let finalClassified: ClassifiedField[] = classified;

  const unknownFields = classified.filter((f) => f.category === "unknown");
  if (unknownFields.length > 0 && API_BASE_URL) {
    const aiResponse = await callAPI<unknown, FormAnalyzeResponse>("/form/analyze", {
      domain,
      fields: unknownFields.map((f) => {
        const original = fields.find((of) => of.id === f.id);
        return {
          id: f.id,
          name: original?.name,
          label: original?.label,
          placeholder: original?.placeholder,
          type: original?.type ?? "text",
          autocomplete: original?.autocomplete,
          required: original?.required ?? false,
        };
      }),
    });

    if (aiResponse?.fields) {
      finalClassified = classified.map((cf) => {
        const aiResult = aiResponse.fields.find((r) => r.id === cf.id);
        return aiResult ?? cf;
      });
    }
  }

  // 3. Policy discovery
  const discoverResponse = await callAPI<unknown, PolicyDiscoverResponse>("/policy/discover", {
    url: pageUrl,
    domain,
  });

  // Fallback: use links found by content script
  let policyUrl = discoverResponse?.privacyPolicy?.url;
  let termsUrl = discoverResponse?.terms?.url;

  if (!policyUrl && privacyLinks.length > 0) {
    const policyLink = privacyLinks.find((l) =>
      /privacy/i.test(l.text) || /privacy/i.test(l.url)
    );
    policyUrl = policyLink?.url;
  }
  if (!termsUrl && privacyLinks.length > 0) {
    const termsLink = privacyLinks.find((l) =>
      /terms/i.test(l.text) || /terms/i.test(l.url)
    );
    termsUrl = termsLink?.url;
  }

  // 4. Policy analysis
  let findings: PolicyAnalyzeResponse["findings"] = [];

  if (policyUrl && API_BASE_URL) {
    const analyzeResponse = await callAPI<unknown, PolicyAnalyzeResponse>("/policy/analyze", {
      domain,
      policyUrl,
      requestedFields: finalClassified
        .filter((f) => f.category !== "unknown")
        .map((f) => ({
          id: f.id,
          category: f.category,
          sensitivity: f.sensitivity,
        })),
    });

    if (analyzeResponse?.findings) {
      findings = analyzeResponse.findings;
    }
  }

  // 5. Build disclosure preview
  const disclosureFields: DisclosureField[] = finalClassified
    .filter((cf) => cf.category !== "unknown")
    .map((cf) => {
      const original = fields.find((f) => f.id === cf.id);
      return {
        fieldId: cf.id,
        label: original?.label || original?.placeholder || original?.name || cf.id,
        category: cf.category,
        sensitivity: cf.sensitivity,
        requirement: cf.requirement,
        selected: true, // default: all selected; user can deselect
        vaultKey: mapCategoryToVaultKey(cf.category, original?.autocomplete, original?.name),
      };
    });

  const preview: DisclosurePreview = {
    domain,
    fields: disclosureFields,
    findings,
    policyUrl,
    termsUrl,
    generatedAt: new Date().toISOString(),
  };

  sessionCache.set(cacheKey, preview);
  return preview;
}

// ─── Map category to vault key ────────────────────────────────────────────────

function mapCategoryToVaultKey(
  category: string,
  autocomplete?: string,
  name?: string
): string | undefined {
  if (autocomplete) {
    const acMap: Record<string, string> = {
      email: "email",
      tel: "phone",
      "given-name": "firstName",
      "family-name": "lastName",
      name: "name",
      "street-address": "address.line1",
      "postal-code": "address.postalCode",
      "address-level1": "address.state",
      "address-level2": "address.city",
      country: "address.country",
      bday: "dateOfBirth",
      organization: "company",
      "organization-title": "jobTitle",
    };
    if (acMap[autocomplete]) return acMap[autocomplete];
  }

  const n = (name ?? "").toLowerCase();
  if (n.includes("email")) return "email";
  if (n.includes("phone") || n.includes("mobile") || n.includes("tel")) return "phone";
  if (n.includes("first")) return "firstName";
  if (n.includes("last") || n.includes("surname")) return "lastName";
  if (n.includes("name")) return "name";
  if (n.includes("dob") || n.includes("birth")) return "dateOfBirth";
  if (n.includes("address") || n.includes("street")) return "address.line1";
  if (n.includes("city")) return "address.city";
  if (n.includes("state") || n.includes("province")) return "address.state";
  if (n.includes("zip") || n.includes("postal") || n.includes("pin")) return "address.postalCode";
  if (n.includes("country")) return "address.country";
  if (n.includes("company") || n.includes("org")) return "company";
  if (n.includes("title") || n.includes("job") || n.includes("designation")) return "jobTitle";

  return undefined;
}

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    const cacheKey = sender.tab?.url
      ? `${new URL(sender.tab.url).hostname}:${sender.tab.url}`
      : "";

    if (message.type === "FORM_DETECTED" && message.payload) {
      const payload = message.payload as FormDetectedPayload;

      analyzeForm(payload)
        .then((preview) => {
          sendResponse({ success: true, preview });
        })
        .catch((err) => {
          console.error("[DataFirewall] Analysis failed:", err);
          sendResponse({ success: false, error: String(err) });
        });

      return true; // keep channel open for async response
    }

    if (message.type === "GET_ANALYSIS") {
      const preview = cacheKey ? sessionCache.get(cacheKey) : null;
      sendResponse({ preview: preview ?? null });
      return true;
    }

    if (message.type === "CLEAR_SESSION") {
      if (cacheKey) sessionCache.delete(cacheKey);
      sendResponse({ success: true });
      return true;
    }

    return false;
  }
);

// Keep service worker alive while processing
chrome.runtime.onInstalled.addListener(() => {
  console.log("[DataFirewall] Extension installed/updated");
});
