"use strict";
// Form Analyze API Handler — classifies form fields using Bedrock LLM with deterministic fallback
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const inputSchemas_1 = require("../validation/inputSchemas");
const client_1 = require("../bedrock/client");
const fieldClassifier_1 = require("../bedrock/prompts/fieldClassifier");
const outputValidator_1 = require("../validation/outputValidator");
const field_classifier_1 = require("@consent-ahead/field-classifier");
async function handler(event) {
    try {
        const body = event.body ? JSON.parse(event.body) : {};
        const parsed = inputSchemas_1.FormAnalyzeRequestSchema.parse(body);
        let classifiedFields;
        // Attempt Bedrock LLM classification
        try {
            const userPrompt = (0, fieldClassifier_1.buildFieldClassifierPrompt)(parsed.fields);
            const bedrockResponse = await (0, client_1.invokeBedrock)(userPrompt, fieldClassifier_1.FIELD_CLASSIFIER_SYSTEM_PROMPT, 0.1);
            const rawResult = (0, outputValidator_1.parseBedrockJson)(bedrockResponse);
            classifiedFields = rawResult.fields;
        }
        catch (bedrockErr) {
            console.warn("Bedrock field classification fallback to deterministic rule engine:", bedrockErr);
            classifiedFields = (0, field_classifier_1.classifyFieldsDeterministically)(parsed.fields);
        }
        const responseBody = {
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
//# sourceMappingURL=formAnalyze.js.map