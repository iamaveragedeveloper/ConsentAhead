"use strict";
// Policy Discover API Handler — finds privacy/terms/deletion policy URLs for a given domain
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const inputSchemas_1 = require("../validation/inputSchemas");
const discoverer_1 = require("../policy/discoverer");
async function handler(event) {
    try {
        const body = event.body ? JSON.parse(event.body) : {};
        const parsed = inputSchemas_1.PolicyDiscoverRequestSchema.parse(body);
        const pageUrl = parsed.pageUrl || `https://${parsed.domain}`;
        const discovered = await (0, discoverer_1.discoverPolicyLinks)(parsed.domain, pageUrl, parsed.pageHtml);
        const responseBody = {
            privacyPolicy: discovered.privacyUrl ? { url: discovered.privacyUrl } : null,
            terms: discovered.termsUrl ? { url: discovered.termsUrl } : null,
            deletion: discovered.deletionUrl ? { url: discovered.deletionUrl } : null,
            dataRequest: discovered.dataRequestUrl ? { url: discovered.dataRequestUrl } : null,
        };
        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify(responseBody),
        };
    }
    catch (err) {
        return {
            statusCode: 400,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({ error: err.message }),
        };
    }
}
//# sourceMappingURL=policyDiscover.js.map