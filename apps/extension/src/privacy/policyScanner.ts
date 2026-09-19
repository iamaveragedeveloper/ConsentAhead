// Privacy Scan: reads a site's privacy policy and terms and reports, in plain language,
// how your details will be used. Runs entirely on this device: the documents are fetched
// straight from the site and analysed locally. Nothing about you is sent anywhere.

export type Tone = "good" | "note" | "warn";
export type DocKind = "privacy" | "terms";

export interface ScanFinding {
  id: string;
  tone: Tone;
  title: string;
  evidence: string;
  sourceUrl: string;
  highlightUrl: string; // opens the page scrolled to, and highlighting, the evidence sentence
  source: DocKind;
}

export interface SourceResult {
  kind: DocKind;
  url: string;
  status: "ok" | "needs-permission" | "failed";
  findings: ScanFinding[];
  origin?: string; // set when status === "needs-permission"
}

// ─── Text extraction ─────────────────────────────────────────────────────────

export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, noscript, svg, nav, header, footer, form, iframe").forEach((n) => n.remove());
  // textContent glues neighbouring blocks together; add a break after each block element
  doc.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, div, br, tr, section, article").forEach((n) => n.append("\n"));
  return (doc.body?.textContent ?? "").replace(/[ \t ]+/g, " ").replace(/\n\s*\n+/g, "\n");
}

// ─── Rules ───────────────────────────────────────────────────────────────────

interface Rule {
  id: string;
  tone: Tone;
  title: string;
  test: (s: string) => boolean;
}

const NEGATION = /\b(do not|don't|does not|doesn't|never|will not|won't|not)\b/i;
// Sentences about information the company RECEIVES from partners, not information it gives out
const INBOUND = /\b(from (trusted |our |other )?(partners|third[- ]part(y|ies)|advertisers)|provide (us|the company)|provides (us|the company)|(collect|receive|obtain)\w*[^.]{0,40}\bfrom\b)/i;
// Sentences about data that can't identify you (aggregated, anonymised) are not a privacy concern
const ANONYMOUS = /\b(non-personally identifiable|non-personal|aggregated?|anonymi[sz]ed|de-identified|does not identify|cannot identify)\b/i;
const near = (s: string, a: RegExp, b: RegExp) => a.test(s) && b.test(s);

const RULES: Rule[] = [
  {
    id: "sell",
    tone: "warn",
    title: "May sell your personal data",
    test: (s) =>
      /\b(sell|sells|sold|selling)\b[^.]{0,80}\b(personal|your)\b[^.]{0,30}\b(information|data)\b/i.test(s) &&
      !/\b(merger|acquisition|assets|bankruptcy|insolvency)\b/i.test(s) && // company sale, not a data sale
      !NEGATION.test(s.slice(0, s.search(/\b(sell|sells|sold|selling)\b/i))),
  },
  {
    id: "no-sell",
    tone: "good",
    title: "Says it does not sell your data",
    test: (s) => /\b(do not|don't|does not|never|will not|won't)\b.{0,40}\b(sell|rent)\b/i.test(s),
  },
  {
    id: "share-ads",
    tone: "warn",
    title: "Shares your data with advertisers",
    test: (s) =>
      /\b(share|disclose|transfer|make available|sell)\b[^.]{0,120}\b(advertis\w+|ad networks?|marketing partners)\b/i.test(s) &&
      !INBOUND.test(s) &&
      !ANONYMOUS.test(s) &&
      !NEGATION.test(s),
  },
  {
    id: "share-third",
    tone: "note",
    title: "Shares your data with third parties",
    test: (s) =>
      /\b(share|disclose|transfer|make available)\b[^.]{0,120}\b(third[- ]part(y|ies)|partners|affiliates|business partners|service providers)\b/i.test(s) &&
      !INBOUND.test(s) &&
      !ANONYMOUS.test(s) &&
      !NEGATION.test(s),
  },
  {
    id: "no-share",
    tone: "good",
    title: "Says it does not share your data",
    test: (s) => /\b(do not|don't|does not|never|will not|won't)\b.{0,30}\b(share|disclose)\b.{0,60}\b(personal|your)\b/i.test(s),
  },
  {
    id: "marketing",
    tone: "note",
    title: "May use your contact details for marketing",
    test: (s) =>
      near(s, /\b(marketing|promotional|promotions|newsletters?|special offers)\b/i, /\b(email|e-mail|communications?|messages?|contact you|send you|sms|text)\b/i) &&
      /\b(use|send|sends|receive|contact|may|will|opt)\b/i.test(s) && // a claim, not a heading
      !NEGATION.test(s),
  },
  {
    id: "tracking",
    tone: "note",
    title: "Tracks you for targeted ads",
    test: (s) =>
      /\b(targeted|personali[sz]ed|interest-based|behaviou?ral)\s+(ads?|advertising)\b/i.test(s) ||
      /\b(cross-site tracking|web beacons?|tracking pixels?|advertising ids?)\b/i.test(s),
  },
  {
    id: "sensitive",
    tone: "note",
    title: "Collects sensitive information",
    test: (s) =>
      /\b(biometric|health|medical|genetic|precise (geo)?location|government[- ]issued|social security|passport|sexual orientation|religio\w+|ethnic\w+)\b/i.test(s) &&
      /\b(collect|process|obtain)\b/i.test(s) &&
      !NEGATION.test(s), // "we don't use sensitive categories" is reassurance, not a concern
  },
  {
    id: "retention-forever",
    tone: "warn",
    title: "May keep your data indefinitely",
    test: (s) => /\b(retain|keep|store|retention)\b/i.test(s) && /\b(indefinitely|permanently|forever)\b/i.test(s) && !NEGATION.test(s),
  },
  {
    id: "retention",
    tone: "note",
    title: "Keeps your data for a set period",
    test: (s) =>
      /\b(retain|keep|store|retention)\b/i.test(s) &&
      /\b(as long as|for (a period|\d+|up to|at least)|\d+\s*(years?|months?|days?)|until)\b/i.test(s),
  },
  {
    id: "transfer",
    tone: "note",
    title: "May move your data to other countries",
    test: (s) =>
      /\b(transfer\w*|process\w*|stor\w+)\b/i.test(s) && /\b(outside (of )?(your|the)|other countries|international(ly)?|united states)\b/i.test(s),
  },
  {
    id: "licence",
    tone: "warn",
    title: "Takes a broad licence over what you submit",
    test: (s) =>
      /\b(perpetual|irrevocable)\b/i.test(s) && /\b(licen[sc]e|sublicens\w+)\b/i.test(s),
  },
  {
    id: "arbitration",
    tone: "note",
    title: "Limits your right to sue (arbitration)",
    test: (s) => /\b(binding arbitration|class[- ]action (waiver|lawsuit)|waive\w*.{0,40}(class action|jury))\b/i.test(s),
  },
  {
    id: "delete",
    tone: "good",
    title: "You can ask to delete your data",
    test: (s) =>
      (/\b(delete|erase|erasure|removal)\b.{0,80}\b(your (personal )?(data|information|account)|request)\b/i.test(s) ||
        /\bright to (delete|erasure|be forgotten)\b/i.test(s)) &&
      /\b(you can|you may|you have|request|contact|submit|visit)\b/i.test(s), // a claim, not a heading
  },
  {
    id: "access",
    tone: "good",
    title: "You can get a copy of your data",
    test: (s) =>
      /\b(access|obtain|receive|export|download|copy of)\b.{0,60}\byour (personal )?(data|information)\b/i.test(s) ||
      /\b(data portability|right (of|to) access)\b/i.test(s),
  },
];

const TONE_ORDER: Record<Tone, number> = { warn: 0, note: 1, good: 2 };

// ─── Analysis ────────────────────────────────────────────────────────────────

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])|\n+|•/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 30 && s.length <= 900);
}

function excerpt(s: string, max = 260): string {
  return s.length <= max ? s : s.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

// Builds a link that opens the page scrolled to a sentence and highlights it. This uses Chrome's
// "text fragments" (#:~:text=start,end): the browser finds the text itself, so it needs no access
// to the page. Long sentences are matched by their first and last few words, which highlights
// everything in between.
export function buildHighlightUrl(url: string, sentence: string): string {
  const words = sentence.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length < 3) return url;

  // Leading/trailing punctuation can break the browser's word-boundary matching
  const trim = (s: string) => s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  // "-", "," and "&" are special inside a text fragment; everything else is percent-encoded
  const enc = (s: string) => encodeURIComponent(s).replace(/-/g, "%2D");

  const edge = Math.min(6, Math.floor(words.length / 2));
  const directive =
    words.length <= 12
      ? enc(trim(words.join(" ")))
      : `${enc(trim(words.slice(0, edge).join(" ")))},${enc(trim(words.slice(-edge).join(" ")))}`;

  // Keep a real #section anchor if the link already has one; the directive goes after it
  const [base, hash = ""] = url.split("#");
  const anchor = hash.split(":~:")[0];
  return `${base}#${anchor}:~:text=${directive}`;
}

export function analyzePolicyText(text: string, sourceUrl: string, source: DocKind): ScanFinding[] {
  const sentences = splitSentences(text);
  const found = new Map<string, ScanFinding>();

  for (const original of sentences) {
    // Sites often use curly apostrophes ("don’t"); normalise so negations are recognised,
    // but keep the original wording for the quote and the highlight so they match the page
    const sentence = original.replace(/[’‘]/g, "'");
    for (const rule of RULES) {
      if (found.has(rule.id)) continue;
      if (rule.test(sentence)) {
        found.set(rule.id, {
          id: `${source}-${rule.id}`,
          tone: rule.tone,
          title: rule.title,
          evidence: excerpt(original),
          sourceUrl,
          highlightUrl: buildHighlightUrl(sourceUrl, original),
          source,
        });
      }
    }
  }

  // A site that says "we don't sell" and also "we may sell": trust the warning
  if (found.has("sell")) found.delete("no-sell");
  // Sharing with advertisers already covers the general third-party finding
  if (found.has("share-ads")) found.delete("share-third");

  return [...found.values()].sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

// ─── Fetching ────────────────────────────────────────────────────────────────

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { credentials: "omit", redirect: "follow", signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.text()).slice(0, 1_500_000);
    const isHtml = (res.headers.get("content-type") ?? "").includes("html") || body.trimStart().startsWith("<");
    return isHtml ? htmlToText(body) : body;
  } finally {
    clearTimeout(timer);
  }
}

async function hasOriginPermission(origin: string): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: [`${origin}/*`] });
  } catch {
    return false;
  }
}

// ─── Cache (so reopening the popup is instant) ───────────────────────────────

const CACHE_KEY = "pdfw_scan_cache_v2"; // v2: findings carry a highlight link
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CacheMap = Record<string, { t: number; findings: ScanFinding[] }>;

/** Removes every cached scan result (used by "Delete all data"). */
export async function clearScanCache(): Promise<void> {
  try {
    await chrome.storage.local.remove(CACHE_KEY);
    await chrome.storage.session.remove("pendingTab");
  } catch {
    /* nothing to clear */
  }
}

async function cacheGet(url: string): Promise<ScanFinding[] | null> {
  try {
    const data = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] as CacheMap | undefined;
    const hit = data?.[url];
    return hit && Date.now() - hit.t < CACHE_TTL_MS ? hit.findings : null;
  } catch {
    return null;
  }
}

async function cacheSet(url: string, findings: ScanFinding[]): Promise<void> {
  try {
    const data = ((await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] as CacheMap | undefined) ?? {};
    data[url] = { t: Date.now(), findings };
    await chrome.storage.local.set({ [CACHE_KEY]: data });
  } catch {
    /* caching is best-effort */
  }
}

// ─── Orchestration ───────────────────────────────────────────────────────────

/** Fetches and analyses one document. Never throws. */
export async function scanDocument(kind: DocKind, url: string, opts: { force?: boolean } = {}): Promise<SourceResult> {
  if (!opts.force) {
    const cached = await cacheGet(url);
    if (cached) return { kind, url, status: "ok", findings: cached };
  }

  try {
    const text = await fetchText(url, 7000);
    if (text.trim().length < 400) return { kind, url, status: "failed", findings: [] }; // JS-rendered or empty
    const findings = analyzePolicyText(text, url, kind);
    void cacheSet(url, findings);
    return { kind, url, status: "ok", findings };
  } catch {
    // A cross-origin fetch fails until the user allows that site
    let origin: string | undefined;
    try {
      origin = new URL(url).origin;
    } catch {
      /* ignore */
    }
    if (origin && !(await hasOriginPermission(origin))) {
      return { kind, url, status: "needs-permission", findings: [], origin };
    }
    return { kind, url, status: "failed", findings: [] };
  }
}

const GUESS_PATHS: Record<DocKind, string[]> = {
  privacy: ["/privacy", "/privacy-policy", "/legal/privacy", "/privacypolicy"],
  terms: ["/terms", "/terms-of-service", "/terms-and-conditions", "/legal/terms", "/tos"],
};

/** When a page has no policy link, try the usual paths on the same site (in parallel). */
export async function guessDocument(kind: DocKind, origin: string): Promise<SourceResult | null> {
  const attempts = GUESS_PATHS[kind].map(async (path) => {
    const url = `${origin}${path}`;
    const text = await fetchText(url, 4000);
    if (text.trim().length < 400) throw new Error("too short");
    return { url, text };
  });

  try {
    const { url, text } = await Promise.any(attempts);
    const findings = analyzePolicyText(text, url, kind);
    void cacheSet(url, findings);
    return { kind, url, status: "ok", findings };
  } catch {
    return null;
  }
}
