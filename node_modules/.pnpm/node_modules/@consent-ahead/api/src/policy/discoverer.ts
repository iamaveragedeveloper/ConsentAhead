// Policy Discovery — finds privacy/terms/deletion links on a website
// Fetches the page and extracts privacy-related links.

import { safeFetch } from "./fetcher";

const POLICY_LINK_PATTERNS = [
  /privacy.?polic/i,
  /privacy.?notice/i,
  /data.?polic/i,
  /terms.?of.?(use|service)/i,
  /terms.?&.?conditions/i,
  /cookie.?polic/i,
  /delete.?account/i,
  /close.?account/i,
  /data.?request/i,
  /your.?privacy/i,
  /legal/i,
];

const DELETION_PATTERNS = [
  /delete.?account/i,
  /close.?account/i,
  /deactivate.?account/i,
  /remove.?account/i,
  /account.?deletion/i,
  /data.?deletion/i,
  /data.?removal/i,
];

const DATA_REQUEST_PATTERNS = [
  /data.?request/i,
  /access.?my.?data/i,
  /download.?my.?data/i,
  /your.?data/i,
  /dsar/i,
  /data.?subject/i,
  /privacy.?request/i,
];

export interface DiscoveredPolicies {
  privacyPolicy: { url: string; title?: string } | null;
  terms: { url: string; title?: string } | null;
  deletion: { url: string; title?: string } | null;
  dataRequest: { url: string; title?: string } | null;
}

export async function discoverPolicyLinks(
  domain: string,
  pageUrl: string,
  _pageHtml?: string
) {
  const discovered = await discoverPolicies(pageUrl, domain);
  return {
    privacyUrl: discovered.privacyPolicy?.url || null,
    termsUrl: discovered.terms?.url || null,
    deletionUrl: discovered.deletion?.url || null,
    dataRequestUrl: discovered.dataRequest?.url || null,
    allDiscoveredUrls: [
      discovered.privacyPolicy?.url,
      discovered.terms?.url,
      discovered.deletion?.url,
      discovered.dataRequest?.url,
    ].filter((u): u is string => Boolean(u)),
  };
}

export async function discoverPolicies(
  pageUrl: string,
  domain: string
): Promise<DiscoveredPolicies> {
  const result: DiscoveredPolicies = {
    privacyPolicy: null,
    terms: null,
    deletion: null,
    dataRequest: null,
  };

  try {
    const html = await safeFetch(pageUrl);
    if (!html) return result;

    const links = extractLinks(html, domain, pageUrl);

    for (const link of links) {
      const textLower = link.text.toLowerCase();
      const urlLower = link.url.toLowerCase();
      const combined = `${textLower} ${urlLower}`;

      // Deletion
      if (!result.deletion && DELETION_PATTERNS.some((p) => p.test(combined))) {
        result.deletion = { url: link.url, title: link.text };
      }

      // Data request
      if (!result.dataRequest && DATA_REQUEST_PATTERNS.some((p) => p.test(combined))) {
        result.dataRequest = { url: link.url, title: link.text };
      }

      // Privacy policy (prioritize same-domain)
      if (!result.privacyPolicy && /privacy/i.test(combined) && !DELETION_PATTERNS.some(p => p.test(combined))) {
        result.privacyPolicy = { url: link.url, title: link.text };
      }

      // Terms
      if (!result.terms && /terms/i.test(combined) && !DELETION_PATTERNS.some(p => p.test(combined))) {
        result.terms = { url: link.url, title: link.text };
      }
    }

    // Try common URL patterns if not found
    if (!result.privacyPolicy) {
      const candidates = [
        `https://${domain}/privacy`,
        `https://${domain}/privacy-policy`,
        `https://${domain}/legal/privacy`,
        `https://${domain}/en/privacy`,
      ];
      for (const url of candidates) {
        const content = await safeFetch(url, { headOnly: true });
        if (content) { result.privacyPolicy = { url }; break; }
      }
    }

  } catch (err) {
    console.error("[discoverer] Error:", err);
  }

  return result;
}

function extractLinks(
  html: string,
  domain: string,
  pageUrl: string
): { text: string; url: string }[] {
  const links: { text: string; url: string }[] = [];
  const hrefRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const base = new URL(pageUrl);

  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const [, href, rawText] = match;
    const text = rawText.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    if (!href || href.startsWith("javascript:") || href === "#") continue;
    if (!POLICY_LINK_PATTERNS.some((p) => p.test(text) || p.test(href))) continue;

    try {
      const resolved = new URL(href, base).href;
      const resolvedUrl = new URL(resolved);

      // Prefer same-domain links
      if (resolvedUrl.hostname === domain || resolvedUrl.hostname === base.hostname) {
        links.unshift({ text, url: resolved }); // same-domain first
      } else {
        links.push({ text, url: resolved });
      }
    } catch {
      // skip invalid URLs
    }
  }

  return links;
}
