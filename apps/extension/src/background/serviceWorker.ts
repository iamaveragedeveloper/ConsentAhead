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
        vaultKey: mapCategoryToVaultKey(cf.category, original),
        selector: original?.selector,
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
  field?: { autocomplete?: string; name?: string; label?: string; placeholder?: string; type?: string }
): string | undefined {
  if (category === "consent" || category === "financial") return undefined; // never auto-fill

  const autocomplete = field?.autocomplete;
  if (autocomplete) {
    const acMap: Record<string, string> = {
      email: "email",
      tel: "phone",
      "given-name": "firstName",
      "family-name": "lastName",
      name: "name",
      "street-address": "address.line1",
      "address-line1": "address.line1",
      "postal-code": "address.postalCode",
      "address-level1": "address.state",
      "address-level2": "address.city",
      country: "address.country",
      "country-name": "address.country",
      bday: "dateOfBirth",
      organization: "company",
      "organization-title": "jobTitle",
      url: "website",
    };
    if (acMap[autocomplete]) return acMap[autocomplete];
  }

  // Fall back to the field's name, label and placeholder (sites like Google Forms have no
  // name/autocomplete, only a visible question title). Ordered most-specific first.
  const text = [field?.name, field?.label, field?.placeholder].filter(Boolean).join(" ").toLowerCase();
  // Date of birth: any wording (Birthdate, DOB, "When were you born?"), including a date split
  // over Day / Month / Year boxes. "Place of birth" is a different question, so it is excluded.
  if (/(dob|d\.o\.b|birth|born)/.test(text) && !/(place|country|city|town|state)\s*of\s*birth|birth\s*(place|country|city|town|state)/.test(text)) {
    // A format hint such as "DD/MM/YYYY" means the box takes the whole date, not one part of it
    if (/(dd|mm|yyyy|yy)\s*[\/.\-]\s*(dd|mm|yyyy|yy)/.test(text)) return "dateOfBirth";
    // Which part a split box wants comes from its label or name, never from a placeholder
    const partText = [field?.name, field?.label].filter(Boolean).join(" ").toLowerCase();
    const has = (word: string) => new RegExp("(^|[^a-z])(" + word + ")([^a-z]|$)").test(partText);
    if (has("day|dd")) return "dateOfBirth.day";
    if (has("month|mm")) return "dateOfBirth.month";
    if (has("year|yyyy|yy")) return "dateOfBirth.year";
    return "dateOfBirth";
  }
  const rules: [RegExp, string][] = [
    [/e-?mail/, "email"],
    [/\b(phone|mobile|cell|telephone|contact number|whatsapp)\b/, "phone"],
    [/first.?name|given.?name|forename/, "firstName"],
    [/last.?name|family.?name|surname/, "lastName"],
    [/\b(dob|birth|birthday)\b|date.?of.?birth/, "dateOfBirth"],
    [/\b(pin.?code|zip|postal)\b/, "address.postalCode"],
    [/\b(city|town)\b/, "address.city"],
    [/\b(state|province)\b/, "address.state"],
    [/\bcountry\b/, "address.country"],
    [/\b(address|street)\b/, "address.line1"],
    [/\b(company|employer|organi[sz]ation|workplace|college|university)\b/, "company"],
    [/job.?title|designation|\brole\b|occupation|position/, "jobTitle"],
    [/\b(website|url|portfolio|linkedin|github)\b/, "website"],
    [/full.?name|your.?name|\bname\b/, "name"],
  ];
  for (const [pattern, key] of rules) {
    if (pattern.test(text)) return key;
  }
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

    if (message.type === "OPEN_POPUP") {
      // The user clicked the shield beside a field: open the toolbar popup.
      // Chrome hides a tab's URL from an extension that has no access to the site yet, so
      // pass along the URL of the page the user just clicked on (their own action) for the
      // popup to show the "Allow access?" screen.
      const tabId = sender.tab?.id;
      const remember =
        tabId !== undefined && sender.url
          ? chrome.storage.session.set({ pendingTab: { tabId, url: sender.url } })
          : Promise.resolve();

      remember
        .then(() => chrome.action.openPopup(sender.tab?.windowId ? { windowId: sender.tab.windowId } : undefined))
        .then(() => sendResponse({ opened: true }))
        .catch(() => {
          // Chrome refused to open it programmatically; point at the toolbar icon instead
          if (tabId !== undefined) {
            chrome.action.setBadgeBackgroundColor({ tabId, color: "#6366f1" });
            chrome.action.setBadgeText({ tabId, text: "•" });
          }
          sendResponse({ opened: false });
        });
      return true; // async response
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
