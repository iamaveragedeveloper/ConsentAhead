// Content Script — Form Detector
// Runs on every page. Detects forms, extracts field metadata,
// and sends a FORM_DETECTED message to the background service worker.
// NEVER collects user-entered values. NEVER submits forms.

import type { FormField, FormDetectedPayload, ExtensionMessage } from "@consent-ahead/shared-types";

const IGNORED_INPUT_TYPES = new Set(["hidden", "submit", "button", "reset", "image", "file"]);

// ─── Field Extraction ─────────────────────────────────────────────────────────

function extractLabel(input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  // 1. Explicit label via for= attribute
  if (input.id) {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`);
    if (label) return label.innerText.trim();
  }
  // 2. Wrapping label
  const parent = input.closest("label");
  if (parent) return parent.innerText.replace(input.value, "").trim();
  // 3. aria-label
  if (input.getAttribute("aria-label")) return input.getAttribute("aria-label")!.trim();
  // 4. aria-labelledby
  const labelledBy = input.getAttribute("aria-labelledby");
  if (labelledBy) {
    const el = document.getElementById(labelledBy);
    if (el) return el.innerText.trim();
  }
  // 5. Nearby text (previous sibling, parent span/div text)
  const prev = input.previousElementSibling;
  if (prev && prev.tagName !== "INPUT") return prev.textContent?.trim() ?? "";

  return "";
}

function getNearbyContext(el: Element): string {
  // Get surrounding public text for classification context
  // Does NOT include user-entered values
  const container = el.closest("div, fieldset, section, form");
  if (!container) return "";
  const text = container.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return text.slice(0, 200); // limit to 200 chars
}

function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function extractFields(): FormField[] {
  const inputs = document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    "input, select, textarea"
  );

  const fields: FormField[] = [];
  let index = 0;

  inputs.forEach((input) => {
    const inputEl = input as HTMLInputElement;
    const type = inputEl.type?.toLowerCase() ?? "text";

    // Skip hidden/submit/button/password fields
    if (IGNORED_INPUT_TYPES.has(type)) return;
    if (type === "password") return; // never touch passwords

    const visible = isVisible(input);
    const label = extractLabel(input);
    const placeholder = inputEl.placeholder ?? "";

    // Skip inputs with no meaningful identification
    const hasIdentifier = label || placeholder || input.name || input.id || inputEl.autocomplete;
    if (!hasIdentifier) return;

    const field: FormField = {
      id: input.id || input.name || `pdf-field-${index}`,
      name: input.name || undefined,
      label: label || undefined,
      placeholder: placeholder || undefined,
      type,
      autocomplete: inputEl.autocomplete || undefined,
      required: inputEl.required || input.getAttribute("required") !== null || input.getAttribute("aria-required") === "true",
      disabled: inputEl.disabled || false,
      visible,
      formId: input.closest("form")?.id || undefined,
      selector: buildSelector(input),
      context: getNearbyContext(input),
    };

    fields.push(field);
    index++;
  });

  return fields;
}

function buildSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el instanceof HTMLInputElement && el.name) return `input[name="${el.name}"]`;
  // fallback: generate a unique path
  const path: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    if (current.id) { selector = `#${CSS.escape(current.id)}`; path.unshift(selector); break; }
    const siblings = Array.from(current.parentElement?.children ?? []).filter(
      (s) => s.tagName === current!.tagName
    );
    if (siblings.length > 1) selector += `:nth-of-type(${siblings.indexOf(current as Element) + 1})`;
    path.unshift(selector);
    current = current.parentElement;
  }
  return path.join(" > ");
}

// ─── Privacy/Terms Link Discovery ────────────────────────────────────────────

function findPrivacyLinks(): { text: string; url: string }[] {
  const PRIVACY_KEYWORDS = /privacy|terms|policy|legal|cookie|data.request|delete.account|gdpr|ccpa/i;
  const links: { text: string; url: string }[] = [];

  document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
    const text = a.innerText.trim();
    const href = a.href;
    if (!href || href.startsWith("javascript:") || href === "#") return;
    if (PRIVACY_KEYWORDS.test(text) || PRIVACY_KEYWORDS.test(href)) {
      // Only same-domain or explicit privacy links
      try {
        const url = new URL(href);
        links.push({ text, url: url.href });
      } catch {
        // skip invalid URLs
      }
    }
  });

  // Deduplicate
  const seen = new Set<string>();
  return links.filter((l) => {
    if (seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });
}

// ─── Shield Badge (floating indicator) ───────────────────────────────────────

function injectShieldBadge(fieldCount: number) {
  // Remove existing badge
  document.getElementById("pdf-shield-badge")?.remove();

  if (fieldCount === 0) return;

  const badge = document.createElement("div");
  badge.id = "pdf-shield-badge";
  badge.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z" fill="#6366f1"/>
      <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span>${fieldCount}</span>
  `;

  Object.assign(badge.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: "2147483647",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
    color: "white",
    padding: "8px 14px",
    borderRadius: "24px",
    fontSize: "13px",
    fontFamily: "Inter, sans-serif",
    fontWeight: "600",
    boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
    cursor: "pointer",
    transition: "all 0.2s ease",
    border: "1px solid rgba(99,102,241,0.3)",
  });

  badge.title = `Personal Data Firewall detected ${fieldCount} personal data field${fieldCount !== 1 ? "s" : ""}. Click the extension icon to review.`;

  badge.addEventListener("mouseenter", () => {
    badge.style.transform = "scale(1.05)";
    badge.style.boxShadow = "0 6px 24px rgba(99,102,241,0.6)";
  });
  badge.addEventListener("mouseleave", () => {
    badge.style.transform = "scale(1)";
    badge.style.boxShadow = "0 4px 20px rgba(99,102,241,0.4)";
  });

  document.body.appendChild(badge);
}

// ─── Autofill Implementation ──────────────────────────────────────────────────

function fillFields(fieldsToFill: { selector: string; value: string }[]) {
  for (const { selector, value } of fieldsToFill) {
    try {
      const el = document.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector);
      if (!el || el.disabled || !isVisible(el)) continue;
      if (el instanceof HTMLInputElement && el.type === "password") continue; // never fill passwords

      // Set value using native input value setter to trigger React/Vue onChange
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;

      if (el instanceof HTMLInputElement && nativeInputValueSetter) {
        nativeInputValueSetter.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } catch (err) {
      console.warn("[DataFirewall] Could not fill field:", selector, err);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function run() {
  const fields = extractFields();
  const privacyLinks = findPrivacyLinks();

  if (fields.length === 0) return;

  const payload: FormDetectedPayload = {
    domain: window.location.hostname,
    pageUrl: window.location.href,
    pageTitle: document.title,
    fields,
    privacyLinks,
  };

  const message: ExtensionMessage<FormDetectedPayload> = {
    type: "FORM_DETECTED",
    payload,
  };

  chrome.runtime.sendMessage(message).catch(() => {
    // Service worker may not be ready — ignore
  });

  injectShieldBadge(fields.length);
}

// ─── Message Listener (from background) ──────────────────────────────────────

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "FILL_FIELDS" && message.payload) {
    const { fields } = message.payload as { fields: { selector: string; value: string }[] };
    fillFields(fields);
    sendResponse({ success: true });
  }
  return true;
});

// ─── Run on page load ─────────────────────────────────────────────────────────

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", run);
} else {
  run();
}

// Re-run on SPA navigation
let lastUrl = location.href;
new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    setTimeout(run, 500); // small delay to let SPA render
  }
}).observe(document, { subtree: true, childList: true });
