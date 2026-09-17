"use strict";
// Policy Discovery — finds privacy/terms/deletion links on a website
// Fetches the page and extracts privacy-related links.
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverPolicyLinks = discoverPolicyLinks;
exports.discoverPolicies = discoverPolicies;
const fetcher_1 = require("./fetcher");
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
async function discoverPolicyLinks(domain, pageUrl, _pageHtml) {
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
        ].filter((u) => Boolean(u)),
    };
}
async function discoverPolicies(pageUrl, domain) {
    const result = {
        privacyPolicy: null,
        terms: null,
        deletion: null,
        dataRequest: null,
    };
    try {
        const html = await (0, fetcher_1.safeFetch)(pageUrl);
        if (!html)
            return result;
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
                const content = await (0, fetcher_1.safeFetch)(url, { headOnly: true });
                if (content) {
                    result.privacyPolicy = { url };
                    break;
                }
            }
        }
    }
    catch (err) {
        console.error("[discoverer] Error:", err);
    }
    return result;
}
function extractLinks(html, domain, pageUrl) {
    const links = [];
    const hrefRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const base = new URL(pageUrl);
    let match;
    while ((match = hrefRegex.exec(html)) !== null) {
        const [, href, rawText] = match;
        const text = rawText.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        if (!href || href.startsWith("javascript:") || href === "#")
            continue;
        if (!POLICY_LINK_PATTERNS.some((p) => p.test(text) || p.test(href)))
            continue;
        try {
            const resolved = new URL(href, base).href;
            const resolvedUrl = new URL(resolved);
            // Prefer same-domain links
            if (resolvedUrl.hostname === domain || resolvedUrl.hostname === base.hostname) {
                links.unshift({ text, url: resolved }); // same-domain first
            }
            else {
                links.push({ text, url: resolved });
            }
        }
        catch {
            // skip invalid URLs
        }
    }
    return links;
}
//# sourceMappingURL=discoverer.js.map