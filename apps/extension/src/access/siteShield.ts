// The shield beside form fields only runs on sites the user has turned it on for.
//
// There is no script on every page. When you choose "Show the shield on this site" the extension
// asks Chrome for access to that one site and registers the shield script for it. Removing the
// site (Dashboard, Data & access) removes both the access and the script.

/** scheme + hostname. Chrome ignores ports in permission patterns, so a site is keyed without one. */
export function siteKey(originOrPattern: string): string {
  try {
    const u = new URL(originOrPattern.replace("*.", ""));
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return originOrPattern;
  }
}

const idFor = (origin: string) => `shield:${siteKey(origin)}`;
const patternFor = (origin: string) => `${siteKey(origin)}/*`;

/** Registers the shield script for one site. Safe to call again. */
export async function registerShield(origin: string): Promise<void> {
  try {
    await chrome.scripting.registerContentScripts([
      { id: idFor(origin), matches: [patternFor(origin)], js: ["trigger.js"], runAt: "document_idle", persistAcrossSessions: true },
    ]);
  } catch {
    /* already registered */
  }
}

export async function shieldEnabled(origin: string): Promise<boolean> {
  try {
    return (await chrome.scripting.getRegisteredContentScripts({ ids: [idFor(origin)] })).length > 0;
  } catch {
    return false;
  }
}

/** Asks for access to this site (must be called from a click), then shows the shield right away. */
export async function enableShield(origin: string, tabId: number | null): Promise<boolean> {
  const granted = await chrome.permissions.request({ origins: [patternFor(origin)] });
  if (!granted) return false;
  await registerShield(origin);
  if (tabId !== null) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["trigger.js"] });
    } catch {
      /* the shield will appear on the next page load */
    }
  }
  return true;
}

export async function unregisterShield(origin: string): Promise<void> {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [idFor(origin)] });
  } catch {
    /* not registered */
  }
}

/** Removes a site completely: its access and its shield script. */
export async function disableShield(origin: string): Promise<void> {
  await unregisterShield(origin);
  await chrome.permissions.remove({ origins: [patternFor(origin)] }).catch(() => false);
}

const isSpecificSite = (pattern: string) => {
  // Parsed with a pattern, not new URL(): Chrome percent-encodes "*" in hostnames
  const host = /^[a-z*]+:\/\/([^/]*)/.exec(pattern)?.[1] ?? "";
  return host !== "" && host !== "*";
};

/** Makes the registered shield scripts match the sites that currently have access. */
export async function reconcileShields(): Promise<void> {
  try {
    const { origins = [] } = await chrome.permissions.getAll();
    const granted = origins.filter(isSpecificSite);
    const registered = await chrome.scripting.getRegisteredContentScripts();
    const keep = new Set(granted.map((o) => idFor(o)));

    // Sites that lost access lose their shield
    const stale = registered.filter((s) => s.id.startsWith("shield:") && !keep.has(s.id)).map((s) => s.id);
    if (stale.length) await chrome.scripting.unregisterContentScripts({ ids: stale });

    // Sites that already have access (for example granted by an earlier version) get one
    const have = new Set(registered.map((s) => s.id));
    for (const o of granted) {
      if (!have.has(idFor(o))) await registerShield(o);
    }
  } catch {
    /* best effort */
  }
}
