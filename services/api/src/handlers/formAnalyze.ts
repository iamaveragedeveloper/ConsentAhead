// Form Analyze API Handler: classifies form fields using Bedrock LLM with deterministic fallback

import { FormAnalyzeRequestSchema } from "../validation/inputSchemas";
import { invokeBedrock } from "../bedrock/client";
import {
  FIELD_CLASSIFIER_SYSTEM_PROMPT,
  buildFieldClassifierPrompt,
} from "../bedrock/prompts/fieldClassifier";
import { parseBedrockJson } from "../validation/outputValidator";
import { classifyFieldsDeterministically } from "@consent-ahead/field-classifier";
import type { FormAnalyzeResponse, ClassifiedField } from "@consent-ahead/shared-types";

export async function handler(event: { body?: string }) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const parsed = FormAnalyzeRequestSchema.parse(body);

    let classifiedFields: ClassifiedField[];

    // Attempt Bedrock LLM classification
    try {
      const userPrompt = buildFieldClassifierPrompt(parsed.fields);
      const bedrockResponse = await invokeBedrock(
        userPrompt,
        FIELD_CLASSIFIER_SYSTEM_PROMPT,
        0.1
      );
      const rawResult = parseBedrockJson<{ fields: ClassifiedField[] }>(bedrockResponse);
      classifiedFields = rawResult.fields;
    } catch (bedrockErr) {
      console.warn("Bedrock field classification fallback to deterministic rule engine:", bedrockErr);
      classifiedFields = classifyFieldsDeterministically(parsed.fields);
    }

    const responseBody: FormAnalyzeResponse = {
      requestId: parsed.domain,
      fields: classifiedFields,
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
