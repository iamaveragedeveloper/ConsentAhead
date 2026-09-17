export interface BedrockConverseOptions {
    systemPrompt: string;
    userMessage: string;
    maxTokens?: number;
    temperature?: number;
}
export interface BedrockConverseResult {
    text: string;
    inputTokens: number;
    outputTokens: number;
}
/**
 * Invoke Bedrock using the Converse API.
 * Returns the text response from the model.
 * Throws on model error or empty response.
 */
export declare function converseWithBedrock(options: BedrockConverseOptions): Promise<BedrockConverseResult>;
export declare function invokeBedrock(userPrompt: string, systemPrompt: string, temperature?: number): Promise<string>;
/**
 * Parse JSON from Bedrock response text.
 * Models sometimes wrap JSON in markdown code fences.
 */
export declare function parseBedrockJSON<T>(text: string): T;
