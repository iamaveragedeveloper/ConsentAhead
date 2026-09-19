// Content Script: Form Scanner
// NOT loaded automatically. The popup injects this only after the user has allowed access
// to the site. It scans on request (TRIGGER_SCAN) and fills fields on request (FILL_FIELDS).
// NEVER collects user-entered values. NEVER submits forms.

import type { FormField, FormDetectedPayload, ExtensionMessage } from "@consent-ahead/shared-types";

// Scoped in a function: every content script shares one JavaScript world per page,
// so top-level names must not leak or they can collide with the other script.
(() => {
const IGNORED_INPUT_TYPES = new Set(["hidden", "submit", "button", "reset", "image", "file"]);

// ─── Field Extraction ─────────────────────────────────────────────────────────

// Visible text of an element with whitespace collapsed and "required" markers removed
function cleanText(el: Element | null | undefined): string {
  if (!el) return "";
  return (el.textContent ?? "")
    .replace(/\s+/g, " ")
    .replace(/required question|\(required\)/gi, "")
    .replace(/\s*\*+\s*$/, "")
    .replace(/\s+(required|optional)\s*$/i, "")
    .trim();
}

function extractRawLabel(input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  // 1. Explicit label via for= attribute
  if (input.id) {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`);
    if (label) return cleanText(label);
  }
  // 2. Wrapping label
  const parent = input.closest("label");
  if (parent) return cleanText(parent);
  // 3. aria-label
  const ariaLabel = input.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;
  // 4. aria-labelledby: a space-separated list of ids (Google Forms uses e.g. "i1 i4");
  //    the first one that has text is the question title
  const labelledBy = input.getAttribute("aria-labelledby");
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) {
      const text = cleanText(document.getElementById(id));
      if (text) return text;
    }
  }
  // 5. Question container heading (Google Forms: div[role=listitem] > div[role=heading])
  const container = input.closest('[role="listitem"], fieldset');
  if (container) {
    const heading = container.querySelector('[role="heading"], legend, h1, h2, h3, h4');
    const text = cleanText(heading);
    if (text) return text;
  }
  // 6. Nearby text (previous sibling)
  const prev = input.previousElementSibling;
  if (prev && prev.tagName !== "INPUT") return cleanText(prev);

  return "";
}

// A date split over several boxes (Day / Month / Year) is labelled only with the part name.
// Prefix the question's heading so "Day" becomes "Date of birth Day" and can be recognised.
const DATE_PART = /^(day( of the month)?|dd|month|mm|year|yyyy|yy)$/i;
// Sub-labels that say what kind of input this is, not what is being asked
const GENERIC_LABEL = /^(date|time|answer|your answer|choose|select|option)$/i;

function extractLabel(input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  let label = extractRawLabel(input);
  if (!label && input instanceof HTMLInputElement && DATE_PART.test(input.placeholder.trim())) {
    label = input.placeholder.trim();
  }
  const container = input.closest('[role="listitem"], fieldset, [role="group"]');
  const heading = cleanText(container?.querySelector('[role="heading"], legend, h1, h2, h3, h4'));

  // Google Forms points a date question's aria-labelledby at a generic sub-label ("Date"), while
  // the real question ("Date of Birth") is the heading above it. Prefer the heading.
  if (GENERIC_LABEL.test(label.trim()) && heading) return heading;

  if (!DATE_PART.test(label.trim())) return label;
  return heading && heading !== label ? `${heading} ${label}` : label;
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
  const usedIds = new Set<string>();
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

    // Stamp the element so it can be found again reliably when filling, since many sites
    // (e.g. Google Forms) give inputs no id or name.
    const stamp = `pdfw-${index}`;
    input.setAttribute("data-pdfw-id", stamp);

    let fieldId = input.id || input.name || stamp;
    if (usedIds.has(fieldId)) fieldId = `${fieldId}-${stamp}`;
    usedIds.add(fieldId);

    const field: FormField = {
      id: fieldId,
      name: input.name || undefined,
      label: label || undefined,
      placeholder: placeholder || undefined,
      type,
      autocomplete: inputEl.autocomplete || undefined,
      required: inputEl.required || input.getAttribute("required") !== null || input.getAttribute("aria-required") === "true",
      disabled: inputEl.disabled || false,
      visible,
      formId: input.closest("form")?.id || undefined,
      selector: `[data-pdfw-id="${stamp}"]`,
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

// ─── Value helpers for dates and dropdowns ────────────────────────────────────

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

// A full date arrives as YYYY-MM-DD. A text box that shows a format hint (dd/mm/yyyy, mm-dd-yyyy…)
// should get the date in that format instead.
function formatForField(el: HTMLElement, value: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!iso || !(el instanceof HTMLInputElement) || el.type !== "text") return value;

  // The format can be a placeholder, or written into the question itself: "Date of birth (dd-mm-yyyy)"
  const label = el instanceof HTMLInputElement ? extractLabel(el) : "";
  const hint = [el.placeholder, el.getAttribute("aria-label"), el.title, el.name, el.id, label].join(" ").toLowerCase();
  const m = /(dd|mm|yyyy|yy)\s*([\/.\-])\s*(dd|mm|yyyy|yy)\s*\2\s*(dd|mm|yyyy|yy)/.exec(hint);
  if (!m) return value;

  const parts: Record<string, string> = { dd: iso[3], mm: iso[2], yyyy: iso[1], yy: iso[1].slice(2) };
  return [m[1], m[3], m[4]].map((k) => parts[k]).join(m[2]);
}

// Picks the <option> that matches a value by its value or its text; numbers match regardless of
// leading zeros ("05" ↔ "5"), and a month number also matches a month name (5 ↔ "May").
function selectOption(el: HTMLSelectElement, value: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  const v = norm(value);
  const opts = Array.from(el.options);

  let hit = opts.find((o) => norm(o.value) === v || norm(o.text) === v);
  if (!hit && /^\d{1,2}$/.test(v)) {
    const n = parseInt(v, 10);
    const isNum = (s: string) => /^\d{1,2}$/.test(norm(s));
    hit = opts.find((o) => isNum(o.value) && parseInt(o.value, 10) === n) ?? opts.find((o) => isNum(o.text) && parseInt(o.text, 10) === n);
    if (!hit && n >= 1 && n <= 12) {
      const name = MONTHS[n - 1];
      hit = opts.find((o) => [norm(o.text), norm(o.value)].some((s) => s === name || s === name.slice(0, 3)));
    }
  }
  if (!hit) return false;
  el.value = hit.value;
  return true;
}

// ─── Autofill Implementation ──────────────────────────────────────────────────

function fillFields(fieldsToFill: { selector: string; value: string }[]): number {
  let filled = 0;
  for (const { selector, value } of fieldsToFill) {
    try {
      const el = document.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector);
      if (!el || el.disabled || !isVisible(el)) continue;
      if (el instanceof HTMLInputElement && el.type === "password") continue; // never fill passwords

      // Use the element type's native value setter so framework-managed inputs
      // (React, Google Forms) notice the change, then fire the events they listen for.
      const proto =
        el instanceof HTMLTextAreaElement
          ? window.HTMLTextAreaElement.prototype
          : el instanceof HTMLSelectElement
            ? window.HTMLSelectElement.prototype
            : window.HTMLInputElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

      el.focus();
      if (el instanceof HTMLSelectElement) {
        if (!selectOption(el, value)) continue; // no matching option: leave it for the user
      } else {
        const text = formatForField(el, value);
        if (nativeSetter) nativeSetter.call(el, text);
        else el.value = text;
      }

      let inputEvent: Event;
      try {
        inputEvent = new InputEvent("input", { bubbles: true, inputType: "insertText", data: value });
      } catch {
        inputEvent = new Event("input", { bubbles: true });
      }
      el.dispatchEvent(inputEvent);
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: false }));

      // Count it only if the page actually kept the value (e.g. a <select> rejects unknown options)
      if (el.value) filled++;
    } catch (err) {
      console.warn("[DataFirewall] Could not fill field:", selector, err);
    }
  }
  return filled;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface ScanResponse {
  success: boolean;
  preview?: unknown;
  error?: string;
}

// Scans the page and asks the service worker to analyze it.
async function run(): Promise<ScanResponse> {
  const fields = extractFields();
  const privacyLinks = findPrivacyLinks();

  if (fields.length === 0) return { success: false, error: "no-fields" };

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

  try {
    return (await chrome.runtime.sendMessage(message)) as ScanResponse;
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── Message Listener (from background) ──────────────────────────────────────

// The popup can re-inject this script into a page that was open before the extension
// was reloaded; the flag stops listeners from being registered twice.
const guard = window as unknown as { __pdfwLoaded?: boolean };

if (!guard.__pdfwLoaded) {
  guard.__pdfwLoaded = true;

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === "FILL_FIELDS" && message.payload) {
      const { fields } = message.payload as { fields: { selector: string; value: string }[] };
      sendResponse({ success: true, filled: fillFields(fields) });
      return false;
    }

    if (message.type === "TRIGGER_SCAN") {
      run().then(sendResponse);
      return true; // async response
    }

    // The popup asks for a page on this same site (the privacy policy). Fetching it from here,
    // as the page itself, needs no extra access. Other sites are refused.
    if (message.type === "FETCH_TEXT") {
      const url = String((message.payload as { url?: string } | undefined)?.url ?? "");
      let sameSite = false;
      try {
        sameSite = new URL(url).origin === location.origin;
      } catch {
        /* not a URL */
      }
      if (!sameSite) {
        sendResponse({ ok: false });
        return false;
      }
      fetch(url, { credentials: "omit", redirect: "follow" })
        .then(async (res) => ({
          ok: res.ok,
          contentType: res.headers.get("content-type") ?? "",
          body: (await res.text()).slice(0, 1_500_000),
        }))
        .then(sendResponse)
        .catch(() => sendResponse({ ok: false }));
      return true; // async response
    }

    return false;
  });

}
})();
