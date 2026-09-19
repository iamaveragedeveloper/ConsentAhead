// Output Validator: validates Bedrock LLM response JSON outputs against strict schemas
// Prevents malformed or hallucinated responses from reaching the client.

import type { PrivacyFinding, DataControlPathway, Severity, FindingType, PathwayType } from "@consent-ahead/shared-types";

export function parseBedrockJson<T>(rawText: string): T {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    throw new Error(`Failed to parse Bedrock JSON response: ${(e as Error).message}. Raw response: ${rawText.slice(0, 200)}...`);
  }
}

export function validatePrivacyFindings(findings: unknown[], policyUrl: string = "#"): PrivacyFinding[] {
  if (!Array.isArray(findings)) {
    return [];
  }

  return findings.map((f, i) => {
    const obj = (f || {}) as Record<string, unknown>;
    const evidenceObj = (obj.evidence || {}) as Record<string, unknown>;

    return {
      id: String(obj.id || `finding-${i + 1}`),
      fieldId: String(obj.fieldId || `field-${i + 1}`),
      type: (obj.type as FindingType) || "marketing",
      severity: (obj.severity as Severity) || "warning",
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

export function validatePathways(pathways: unknown[], domain: string): DataControlPathway[] {
  if (!Array.isArray(pathways)) {
    return [];
  }

  return pathways.map((p) => {
    const obj = (p || {}) as Record<string, unknown>;
    return {
      type: (obj.type as PathwayType) || "account_deletion",
      url: String(obj.url || `https://${domain}/delete-account`),
      sourceUrl: String(obj.sourceUrl || `https://${domain}/privacy`),
      description: obj.description ? String(obj.description) : "Account deletion portal",
    };
  });
}
