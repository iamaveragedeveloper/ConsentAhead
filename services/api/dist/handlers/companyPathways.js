"use strict";
// Company Pathways API Handler — finds data control pathways (deletion, opt-out, access)
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const inputSchemas_1 = require("../validation/inputSchemas");
const fetcher_1 = require("../policy/fetcher");
const extractor_1 = require("../policy/extractor");
const client_1 = require("../bedrock/client");
const deletionPathway_1 = require("../bedrock/prompts/deletionPathway");
const outputValidator_1 = require("../validation/outputValidator");
async function handler(event) {
    try {
        const body = event.body ? JSON.parse(event.body) : {};
        const parsed = inputSchemas_1.CompanyPathwaysRequestSchema.parse(body);
        let pathways = [];
        if (parsed.policyUrl) {
            try {
                const rawPolicyHtml = await (0, fetcher_1.safeFetch)(parsed.policyUrl);
                if (rawPolicyHtml) {
                    const extracted = (0, extractor_1.extractTextFromHtml)(rawPolicyHtml);
                    const userPrompt = (0, deletionPathway_1.buildDeletionPathwayPrompt)(parsed.domain, extracted.text);
                    const bedrockResponse = await (0, client_1.invokeBedrock)(userPrompt, deletionPathway_1.DELETION_PATHWAY_SYSTEM_PROMPT, 0.1);
                    const rawResult = (0, outputValidator_1.parseBedrockJson)(bedrockResponse);
                    pathways = (0, outputValidator_1.validatePathways)(rawResult.pathways, parsed.domain);
                }
            }
            catch (err) {
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
        const responseBody = {
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
//# sourceMappingURL=companyPathways.js.map