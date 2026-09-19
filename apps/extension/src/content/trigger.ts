// Trigger: runs only on sites the user turned the shield on for (registered per site by
// access/siteShield.ts). There is no script on every page.
//
// It reads NOTHING from the page: no labels, values, links or text, and it sends no page data
// anywhere. All it does is show a small shield beside the form field you click into.
// Clicking the shield asks the extension to open its popup, where you are asked whether
// to allow access to this site before anything is scanned.

// Scoped in a function: every content script shares one JavaScript world per page,
// so top-level names must not leak or they can collide with the other script.
(() => {
const SKIP_TYPES = new Set([
  "hidden", "submit", "button", "reset", "image", "file",
  "password", "checkbox", "radio", "range", "color", "search",
]);
const SKIP_ROLES = new Set(["searchbox", "combobox"]);

const BADGE_SIZE = 28;

const guard = window as unknown as { __pdfwTrigger?: boolean };

function isFillable(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  if (!(target instanceof HTMLElement)) return false;
  if (SKIP_ROLES.has(target.getAttribute("role") ?? "")) return false;

  if (target instanceof HTMLInputElement) {
    return !SKIP_TYPES.has(target.type) && !target.disabled && !target.readOnly;
  }
  if (target instanceof HTMLTextAreaElement) return !target.disabled && !target.readOnly;
  if (target instanceof HTMLSelectElement) return !target.disabled;
  return false;
}

if (!guard.__pdfwTrigger) {
  guard.__pdfwTrigger = true;

  let host: HTMLDivElement | null = null;
  let field: HTMLElement | null = null;
  let hideTimer: number | undefined;
  let frame = 0;

  const ensureBadge = (): HTMLDivElement => {
    if (host) return host;

    host = document.createElement("div");
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `
      <style>
        button {
          all: unset; box-sizing: border-box; width: ${BADGE_SIZE}px; height: ${BADGE_SIZE}px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 9px; background: #6366f1; color: #fff; cursor: pointer;
          box-shadow: 0 2px 10px rgba(0,0,0,.35); transition: transform .12s, background .12s;
        }
        button:hover { background: #4f46e5; transform: scale(1.08); }
        button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
        .hint {
          position: absolute; right: ${BADGE_SIZE + 8}px; top: 0; white-space: nowrap;
          font: 12px/28px system-ui, sans-serif; color: #fff; background: #18181b;
          padding: 0 10px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,.35);
        }
      </style>
      <div class="hint" hidden>Click the Data Firewall icon in your toolbar</div>
      <button type="button" title="Data Firewall: click to review this form" aria-label="Open Data Firewall">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
      </button>`;

    const button = root.querySelector("button")!;
    // Keep focus in the field while clicking the badge
    button.addEventListener("mousedown", (e) => e.preventDefault());
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      // If Chrome won't open the popup by itself, tell the user where to click instead
      const showHint = () => {
        const hint = root.querySelector<HTMLElement>(".hint");
        if (!hint) return;
        hint.hidden = false;
        window.setTimeout(() => (hint.hidden = true), 4000);
      };
      try {
        chrome.runtime
          .sendMessage({ type: "OPEN_POPUP" })
          .then((res) => res?.opened === false && showHint())
          .catch(showHint);
      } catch {
        showHint(); // extension was reloaded, so the page needs a refresh
      }
    });

    Object.assign(host.style, {
      position: "fixed",
      zIndex: "2147483647",
      width: `${BADGE_SIZE}px`,
      height: `${BADGE_SIZE}px`,
      display: "none",
    });
    document.documentElement.appendChild(host);
    return host;
  };

  const place = () => {
    if (!host || !field) return;
    const rect = field.getBoundingClientRect();
    const offscreen = rect.bottom < 0 || rect.top > window.innerHeight;
    if (offscreen || rect.width < 24 || rect.height < 12) {
      host.style.display = "none";
      return;
    }

    // Beside the field; tucked inside its right edge when there is no room outside
    let left = rect.right + 8;
    if (left + BADGE_SIZE > window.innerWidth - 4) left = rect.right - BADGE_SIZE - 6;
    const top = Math.min(Math.max(rect.top + rect.height / 2 - BADGE_SIZE / 2, 4), window.innerHeight - BADGE_SIZE - 4);

    host.style.left = `${Math.max(left, 4)}px`;
    host.style.top = `${top}px`;
    host.style.display = "block";
  };

  const schedulePlace = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(place);
  };

  const hide = () => {
    field = null;
    if (host) host.style.display = "none";
  };

  document.addEventListener(
    "focusin",
    (e) => {
      window.clearTimeout(hideTimer);
      if (isFillable(e.target)) {
        field = e.target;
        ensureBadge();
        place();
      } else {
        hide();
      }
    },
    true
  );

  document.addEventListener(
    "focusout",
    () => {
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(hide, 250);
    },
    true
  );

  window.addEventListener("scroll", schedulePlace, true);
  window.addEventListener("resize", schedulePlace);
}
})();
