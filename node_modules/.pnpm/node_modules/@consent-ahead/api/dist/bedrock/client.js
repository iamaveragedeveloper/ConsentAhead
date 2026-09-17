"use strict";
// Bedrock Runtime client — wraps the Converse API
// Model ID is always configured via environment variable.
// NEVER hard-code model IDs in business logic.
Object.defineProperty(exports, "__esModule", { value: true });
exports.converseWithBedrock = converseWithBedrock;
exports.invokeBedrock = invokeBedrock;
exports.parseBedrockJSON = parseBedrockJSON;
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const region = process.env.BEDROCK_REGION ?? "us-east-1";
const modelId = process.env.BEDROCK_MODEL_ID ?? "amazon.nova-lite-v1:0";
const client = new client_bedrock_runtime_1.BedrockRuntimeClient({ region });
/**
 * Invoke Bedrock using the Converse API.
 * Returns the text response from the model.
 * Throws on model error or empty response.
 */
async function converseWithBedrock(options) {
    const { systemPrompt, userMessage, maxTokens = 2048, temperature = 0.1 } = options;
    const messages = [
        {
            role: "user",
            content: [{ text: userMessage }],
        },
    ];
    const command = new client_bedrock_runtime_1.ConverseCommand({
        modelId,
        messages,
        system: [{ text: systemPrompt }],
        inferenceConfig: {
            maxTokens,
            temperature,
        },
    });
    const response = await client.send(command);
    const outputMessage = response.output?.message;
    const textContent = outputMessage?.content?.find((c) => "text" in c);
    if (!textContent || !("text" in textContent) || !textContent.text) {
        throw new Error("Bedrock returned empty response");
    }
    return {
        text: textContent.text,
        inputTokens: response.usage?.inputTokens ?? 0,
        outputTokens: response.usage?.outputTokens ?? 0,
    };
}
async function invokeBedrock(userPrompt, systemPrompt, temperature = 0.1) {
    const res = await converseWithBedrock({
        systemPrompt,
        userMessage: userPrompt,
        temperature,
    });
    return res.text;
}
/**
 * Parse JSON from Bedrock response text.
 * Models sometimes wrap JSON in markdown code fences.
 */
function parseBedrockJSON(text) {
    // Strip markdown code fences if present
    const cleaned = text
        .replace(/^```(?:json)?\s*/m, "")
        .replace(/\s*```\s*$/m, "")
        .trim();
    return JSON.parse(cleaned);
}
//# sourceMappingURL=client.js.map