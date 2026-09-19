// Bedrock Runtime client: wraps the Converse API
// Model ID is always configured via environment variable.
// NEVER hard-code model IDs in business logic.

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type ContentBlock,
} from "@aws-sdk/client-bedrock-runtime";

const region = process.env.BEDROCK_REGION ?? "us-east-1";
const modelId = process.env.BEDROCK_MODEL_ID ?? "amazon.nova-lite-v1:0";

const client = new BedrockRuntimeClient({ region });

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
export async function converseWithBedrock(
  options: BedrockConverseOptions
): Promise<BedrockConverseResult> {
  const { systemPrompt, userMessage, maxTokens = 2048, temperature = 0.1 } = options;

  const messages: Message[] = [
    {
      role: "user",
      content: [{ text: userMessage } as ContentBlock],
    },
  ];

  const command = new ConverseCommand({
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

export async function invokeBedrock(
  userPrompt: string,
  systemPrompt: string,
  temperature = 0.1
): Promise<string> {
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
export function parseBedrockJSON<T>(text: string): T {
  // Strip markdown code fences if present
  const cleaned = text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  return JSON.parse(cleaned) as T;
}
