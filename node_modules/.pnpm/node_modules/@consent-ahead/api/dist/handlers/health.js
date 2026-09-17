"use strict";
// Health check Lambda handler
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
async function handler() {
    return {
        statusCode: 200,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
            status: "ok",
            service: "ConsentAhead API",
            timestamp: new Date().toISOString(),
            bedrockRegion: process.env.BEDROCK_REGION || "us-east-1",
            bedrockModelId: process.env.BEDROCK_MODEL_ID || "amazon.nova-lite-v1:0",
        }),
    };
}
//# sourceMappingURL=health.js.map