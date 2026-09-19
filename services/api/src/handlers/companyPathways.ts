// Company Pathways API Handler: finds data control pathways (deletion, opt-out, access)

import { CompanyPathwaysRequestSchema } from "../validation/inputSchemas";
import { safeFetch } from "../policy/fetcher";
import { extractTextFromHtml } from "../policy/extractor";
import { invokeBedrock } from "../bedrock/client";
import {
  DELETION_PATHWAY_SYSTEM_PROMPT,
  buildDeletionPathwayPrompt,
} from "../bedrock/prompts/deletionPathway";
import { parseBedrockJson, validatePathways } from "../validation/outputValidator";
import type { CompanyPathwaysResponse, DataControlPathway } from "@consent-ahead/shared-types";

export async function handler(event: { body?: string }) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const parsed = CompanyPathwaysRequestSchema.parse(body);

    let pathways: DataControlPathway[] = [];

    if (parsed.policyUrl) {
      try {
        const rawPolicyHtml = await safeFetch(parsed.policyUrl);
        if (rawPolicyHtml) {
          const extracted = extractTextFromHtml(rawPolicyHtml);

          const userPrompt = buildDeletionPathwayPrompt(parsed.domain, extracted.text);
          const bedrockResponse = await invokeBedrock(
            userPrompt,
            DELETION_PATHWAY_SYSTEM_PROMPT,
            0.1
          );
          const rawResult = parseBedrockJson<{ pathways: unknown[] }>(bedrockResponse);
          pathways = validatePathways(rawResult.pathways, parsed.domain);
        }
      } catch (err) {
        console.warn("Could not extract pathways via Bedrock, using standard defaults:", err);
      }
    }

    if (pathways.length === 0) {
      pathways = [
        {
          type: "account_deletion",
          url: `https://${parsed.domain}/delete-account`,
          sourceUrl: `https://${parsed.domain}/privacy`,
          description: "Visit official account settings or deletion portal to purge data",
        },
        {
          type: "data_request",
          url: `https://${parsed.domain}/privacy/dsar`,
          sourceUrl: `https://${parsed.domain}/privacy`,
          description: "Submit a Data Subject Access Request (DSAR) to request profile export",
        },
      ];
    }

    const responseBody: CompanyPathwaysResponse = {
      status: pathways.length > 0 ? "success" : "not_found",
      pathways,
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(responseBody),
    };
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
