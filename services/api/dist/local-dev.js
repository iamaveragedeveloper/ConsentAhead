"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Local Dev Server — runs all API handlers via http for local testing
const http_1 = __importDefault(require("http"));
const health_1 = require("./handlers/health");
const formAnalyze_1 = require("./handlers/formAnalyze");
const policyDiscover_1 = require("./handlers/policyDiscover");
const policyAnalyze_1 = require("./handlers/policyAnalyze");
const companyPathways_1 = require("./handlers/companyPathways");
const PORT = 3001;
const server = http_1.default.createServer(async (req, res) => {
    // CORS Headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }
    let bodyStr = "";
    req.on("data", (chunk) => {
        bodyStr += chunk;
    });
    req.on("end", async () => {
        const url = req.url || "/";
        let lambdaEvent = { body: bodyStr };
        let result;
        try {
            if (url === "/health" || url === "/") {
                result = await (0, health_1.handler)();
            }
            else if (url === "/form/analyze") {
                result = await (0, formAnalyze_1.handler)(lambdaEvent);
            }
            else if (url === "/policy/discover") {
                result = await (0, policyDiscover_1.handler)(lambdaEvent);
            }
            else if (url === "/policy/analyze") {
                result = await (0, policyAnalyze_1.handler)(lambdaEvent);
            }
            else if (url === "/company/pathways") {
                result = await (0, companyPathways_1.handler)(lambdaEvent);
            }
            else {
                result = {
                    statusCode: 404,
                    body: JSON.stringify({ error: "Endpoint not found" }),
                };
            }
        }
        catch (e) {
            result = {
                statusCode: 500,
                body: JSON.stringify({ error: e.message }),
            };
        }
        res.writeHead(result.statusCode, {
            "Content-Type": "application/json",
            ...(result.headers || {}),
        });
        res.end(result.body);
    });
});
server.listen(PORT, () => {
    console.log(`[ConsentAhead Local API] Server running on http://localhost:${PORT}`);
    console.log(`Endpoints available:`);
    console.log(`  GET  http://localhost:${PORT}/health`);
    console.log(`  POST http://localhost:${PORT}/form/analyze`);
    console.log(`  POST http://localhost:${PORT}/policy/discover`);
    console.log(`  POST http://localhost:${PORT}/policy/analyze`);
    console.log(`  POST http://localhost:${PORT}/company/pathways`);
});
//# sourceMappingURL=local-dev.js.map