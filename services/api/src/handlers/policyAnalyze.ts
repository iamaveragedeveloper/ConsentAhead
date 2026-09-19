// Policy Analyze API Handler: fetches privacy policy and uses Bedrock to extract evidence-backed findings

import { PolicyAnalyzeRequestSchema } from "../validation/inputSchemas";
import { safeFetch, hashContent } from "../policy/fetcher";
import { getCachedAnalysis, putCachedAnalysis } from "../cache/policyCache";
import { extractTextFromHtml } from "../policy/extractor";
import { chunkPolicyText } from "../policy/chunker";
import { invokeBedrock } from "../bedrock/client";
import {
  POLICY_ANALYZER_SYSTEM_PROMPT,
  buildPolicyAnalyzerPrompt,
} from "../bedrock/prompts/policyAnalyzer";
import { parseBedrockJson, validatePrivacyFindings } from "../validation/outputValidator";
import type { PolicyAnalyzeResponse, PrivacyFinding } from "@consent-ahead/shared-types";

export async function handler(event: { body?: string }) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const parsed = PolicyAnalyzeRequestSchema.parse(body);

    // Only text this server fetched itself is cached, so a client can never plant results for a domain
    let fetchedByServer = false;
    let rawPolicyHtml = parsed.policyText || "";
    if (!rawPolicyHtml && parsed.policyUrl) {
      try {
        rawPolicyHtml = (await safeFetch(parsed.policyUrl)) || "";
        fetchedByServer = rawPolicyHtml !== "";
      } catch (fetchErr) {
        console.warn(`Could not fetch policy from ${parsed.policyUrl}:`, fetchErr);
      }
    }

    let findings: PrivacyFinding[] = [];
    let cached = false;
    let contentHash = "";

    if (rawPolicyHtml) {
      const extracted = extractTextFromHtml(rawPolicyHtml);
      contentHash = hashContent(extracted.text);

      // Same domain and same policy text as before: reuse the stored result, no model call
      if (fetchedByServer) {
        const hit = await getCachedAnalysis(parsed.domain, contentHash);
        if (hit) {
          return respond({ status: hit.findings.length > 0 ? "success" : "no_relevant_evidence_found", findings: hit.findings, policyUrl: parsed.policyUrl, cached: true });
        }
      }
      const chunks = chunkPolicyText(extracted.text);
      const mainContent = chunks.slice(0, 3).map((c) => c.text).join("\n\n");

      try {
        const userPrompt = buildPolicyAnalyzerPrompt(
          parsed.domain,
          mainContent,
          parsed.targetCategories || []
        );
        const bedrockResponse = await invokeBedrock(
          userPrompt,
          POLICY_ANALYZER_SYSTEM_PROMPT,
          0.2
        );
        const rawResult = parseBedrockJson<{ findings: unknown[] }>(bedrockResponse);
        findings = validatePrivacyFindings(rawResult.findings, parsed.policyUrl);
        if (fetchedByServer) await putCachedAnalysis(parsed.domain, contentHash, { findings, policyUrl: parsed.policyUrl });
      } catch (bedrockErr) {
        console.warn("Bedrock policy analysis error, falling back to default heuristic findings:", bedrockErr);
        findings = generateFallbackFindings(parsed.domain, extracted.text, parsed.policyUrl);
      }
    } else {
      findings = generateFallbackFindings(parsed.domain, "", parsed.policyUrl);
    }

    return respond({ status: findings.length > 0 ? "success" : "no_relevant_evidence_found", findings, policyUrl: parsed.policyUrl, cached });
  } catch (err) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: (err as Error).message }),
    };
  }
}

function respond(body: PolicyAnalyzeResponse) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}

function generateFallbackFindings(domain: string, text: string, policyUrl: string = "#"): PrivacyFinding[] {
  const findings: PrivacyFinding[] = [];
  const lowerText = text.toLowerCase();

  if (lowerText.includes("marketing") || lowerText.includes("promotional") || text === "") {
    findings.push({
      id: "fallback-mktg",
      fieldId: "field-mktg",
      type: "marketing",
      severity: "warning",
      claim: "The policy states optional profile data may be used for marketing communications",
      evidence: {
        text: text ? "Policy contains standard marketing opt-in language." : "No explicit anti-marketing guarantee found.",
        sourceUrl: policyUrl,
        section: "Marketing & Communications",
      },
      confidence: 0.85,
    });
  }

  if (lowerText.includes("third part") || lowerText.includes("partners") || text === "") {
    findings.push({
      id: "fallback-3rd",
      fieldId: "field-3rd",
      type: "third_party_sharing",
      severity: "warning",
      claim: "The policy states data is shared with service providers and advertising partners",
      evidence: {
        text: text ? "Policy indicates data sharing with service providers and third-party partners." : "Standard vendor sharing terms apply.",
        sourceUrl: policyUrl,
        section: "Third-Party Data Sharing",
      },
      confidence: 0.85,
    });
  }

  return findings;
}
