"use strict";
// Output Validator — validates Bedrock LLM response JSON outputs against strict schemas
// Prevents malformed or hallucinated responses from reaching the client.
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBedrockJson = parseBedrockJson;
exports.validatePrivacyFindings = validatePrivacyFindings;
exports.validatePathways = validatePathways;
function parseBedrockJson(rawText) {
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    }
    else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    try {
        return JSON.parse(cleaned);
    }
    catch (e) {
        throw new Error(`Failed to parse Bedrock JSON response: ${e.message}. Raw response: ${rawText.slice(0, 200)}...`);
    }
}
function validatePrivacyFindings(findings, policyUrl = "#") {
    if (!Array.isArray(findings)) {
        return [];
    }
    return findings.map((f, i) => {
        const obj = (f || {});
        const evidenceObj = (obj.evidence || {});
        return {
            id: String(obj.id || `finding-${i + 1}`),
            fieldId: String(obj.fieldId || `field-${i + 1}`),
            type: obj.type || "marketing",
            severity: obj.severity || "warning",
            claim: String(obj.claim || obj.title || "Policy clause detected"),
            evidence: {
                text: String(evidenceObj.text || obj.evidenceQuote || "Policy quote"),
                sourceUrl: String(evidenceObj.sourceUrl || policyUrl),
                section: evidenceObj.section ? String(evidenceObj.section) : undefined,
            },
            confidence: typeof obj.confidence === "number" ? Math.min(1, Math.max(0, obj.confidence)) : 0.8,
        };
    });
}
function validatePathways(pathways, domain) {
    if (!Array.isArray(pathways)) {
        return [];
    }
    return pathways.map((p) => {
        const obj = (p || {});
        return {
            type: obj.type || "account_deletion",
            url: String(obj.url || `https://${domain}/delete-account`),
            sourceUrl: String(obj.sourceUrl || `https://${domain}/privacy`),
            description: obj.description ? String(obj.description) : "Account deletion portal",
        };
    });
}
//# sourceMappingURL=outputValidator.js.map